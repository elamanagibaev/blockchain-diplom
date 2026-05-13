from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, get_optional_user
from app.constants.lifecycle import is_ledger_registered_status
from app.core.config import get_settings
from app.models.blockchain_event import BlockchainEvent
from app.models.digital_object import DigitalObject
from app.models.document_event import DocumentEvent
from app.models.user import User
from app.schemas.verification import FileVerificationResult, PublicVerifyDocumentResponse
from app.services.pipeline_service import PipelineService
from app.utils.block_explorer import make_tx_explorer_url
from app.services.verification_service import VerificationService
from app.utils.sanitizer import sanitize_hash
from app.services.file_service import _storage_for_obj, get_storage_backend

router = APIRouter(prefix="/verify", tags=["verification"])
settings = get_settings()


def _trust_chain_snapshot(db: Session, document_id: UUID) -> dict[str, str | bool | None]:
    rows = (
        db.query(DocumentEvent)
        .filter(DocumentEvent.document_id == document_id, DocumentEvent.action == "VERIFY_FAILED")
        .order_by(DocumentEvent.timestamp.desc())
        .limit(20)
        .all()
    )
    for row in rows:
        meta = row.event_metadata if isinstance(row.event_metadata, dict) else {}
        if meta.get("method") == "demo_data_change" and meta.get("integrity_status") == "MISMATCH":
            tx_hash = meta.get("trust_chain_tx_hash")
            return {
                "trust_chain_status": "BROKEN",
                "trust_chain_reason": "HASH_MISMATCH",
                "trust_chain_tx_hash": tx_hash,
                "trust_chain_tx_explorer_url": make_tx_explorer_url(tx_hash),
                "registered_hash": meta.get("registered_hash"),
                "current_hash": meta.get("current_hash"),
                "registered_original_available": bool(meta.get("registered_original_storage_key")),
                "registered_original_hash": meta.get("registered_original_hash") or meta.get("registered_hash"),
            }
    return {
        "trust_chain_status": "OK",
        "trust_chain_reason": None,
        "trust_chain_tx_hash": None,
        "trust_chain_tx_explorer_url": None,
        "registered_hash": None,
        "current_hash": None,
        "registered_original_available": False,
        "registered_original_hash": None,
    }


def _registered_original_snapshot(db: Session, document_id: UUID) -> dict[str, str | int] | None:
    rows = (
        db.query(DocumentEvent)
        .filter(DocumentEvent.document_id == document_id, DocumentEvent.action == "VERIFY_FAILED")
        .order_by(DocumentEvent.timestamp.desc())
        .limit(20)
        .all()
    )
    for row in rows:
        meta = row.event_metadata if isinstance(row.event_metadata, dict) else {}
        key = meta.get("registered_original_storage_key")
        if meta.get("method") == "demo_data_change" and key:
            return {
                "storage_key": key,
                "storage_backend": meta.get("registered_original_storage_backend") or "local",
                "file_name": meta.get("registered_original_file_name") or "registered_original.pdf",
                "mime_type": meta.get("registered_original_mime_type") or "application/pdf",
                "size_bytes": meta.get("registered_original_size_bytes") or 0,
            }
    return None


def _enrich_pipeline(obj: DigitalObject, db: Session) -> tuple[int | None, list, list]:
    ps = PipelineService.compute_processing_stage(obj)
    hist = obj.stage_history if isinstance(getattr(obj, "stage_history", None), list) else []
    events = (
        db.query(BlockchainEvent)
        .filter(BlockchainEvent.document_id == obj.id)
        .order_by(BlockchainEvent.timestamp.asc())
        .all()
    )
    chain = [
        {
            "action_type": e.action_type,
            "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            "tx_hash": e.tx_hash,
            "from_wallet": e.from_wallet,
            "to_wallet": e.to_wallet,
        }
        for e in events
    ]
    return ps, hist, chain


def _result_from(sha: str, obj, status: str, db: Session | None = None) -> FileVerificationResult:
    if status == "INVALID_HASH":
        return FileVerificationResult(
            verification_status="INVALID_HASH",
            is_verified=False,
            digital_object_id=None,
            registered_at=None,
            registration_timestamp=None,
            owner_id=None,
            owner_email=None,
            owner_wallet_address=None,
            file_name=None,
            description=None,
            transaction_hash=None,
            tx_explorer_url=None,
            blockchain_registered_at=None,
            blockchain_object_id=None,
            status=None,
            integrity_status="INVALID_HASH",
            trust_chain_status=None,
            trust_chain_reason=None,
            trust_chain_tx_hash=None,
            trust_chain_tx_explorer_url=None,
            sha256_hash=sha,
            sha256_stored=None,
            processing_stage=None,
            stage_history=[],
            chain_events=[],
            department_approved_at=None,
            deanery_approved_at=None,
            student_wallet_address=None,
        )
    if status not in ("VALID", "INVALID", "NOT_FOUND"):
        raise ValueError(status)
    integrity_map = {"VALID": "OK", "INVALID": "INVALID_ON_CHAIN", "NOT_FOUND": "NOT_FOUND"}
    owner_email = obj.owner.email if obj and obj.owner else None
    wallet = obj.owner_wallet_address or (obj.owner.wallet_address if obj and obj.owner else None)
    reg_ts = obj.blockchain_registered_at if obj and status == "VALID" else None
    ps, hist, chain = (None, [], [])
    dept_at = None
    dean_at = None
    student_w = None
    if obj and db:
        ps, hist, chain = _enrich_pipeline(obj, db)
        dept_at = getattr(obj, "department_approved_at", None)
        dean_at = getattr(obj, "deanery_approved_at", None)
        student_w = getattr(obj, "student_wallet_address", None)
    trust = _trust_chain_snapshot(db, obj.id) if obj and db else {}
    verification_status = "TRUST_CHAIN_BROKEN" if trust.get("trust_chain_status") == "BROKEN" else status
    return FileVerificationResult(
        verification_status=verification_status,
        is_verified=(status == "VALID" and trust.get("trust_chain_status") != "BROKEN"),
        digital_object_id=obj.id if obj else None,
        registered_at=obj.created_at if obj else None,
        registration_timestamp=reg_ts,
        owner_id=obj.owner_id if obj else None,
        owner_email=owner_email,
        owner_wallet_address=wallet,
        file_name=obj.file_name if obj else None,
        description=obj.description if obj else None,
        transaction_hash=obj.blockchain_tx_hash if obj else None,
        tx_explorer_url=make_tx_explorer_url(obj.blockchain_tx_hash if obj else None),
        blockchain_registered_at=obj.blockchain_registered_at if obj else None,
        blockchain_object_id=str(obj.blockchain_object_id) if obj and obj.blockchain_object_id else None,
        status=obj.status if obj else None,
        integrity_status="TRUST_CHAIN_BROKEN" if trust.get("trust_chain_status") == "BROKEN" else integrity_map[status],
        trust_chain_status=trust.get("trust_chain_status"),
        trust_chain_reason=trust.get("trust_chain_reason"),
        trust_chain_tx_hash=trust.get("trust_chain_tx_hash"),
        trust_chain_tx_explorer_url=trust.get("trust_chain_tx_explorer_url"),
        sha256_hash=sha,
        sha256_stored=obj.sha256_hash if obj else None,
        processing_stage=ps,
        stage_history=hist,
        chain_events=chain,
        department_approved_at=dept_at,
        deanery_approved_at=dean_at,
        student_wallet_address=student_w,
    )


@router.post("/file", response_model=FileVerificationResult)
async def verify_file(
    upload_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    sha, obj, status = VerificationService(db).verify_file_upload(upload_file, current_user)
    return _result_from(sha, obj, status, db)


@router.get("/hash/{sha256}", response_model=FileVerificationResult)
def verify_hash(
    sha256: str,
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    sha256 = sanitize_hash(sha256)
    if len(sha256) != 64:
        return _result_from(sha256, None, "INVALID_HASH", db)

    uid = current_user.id if current_user else None
    obj, status = VerificationService(db).verify_by_hash_public(sha256, requested_by_id=uid, method="hash_lookup")
    return _result_from(sha256, obj, status, db)


@router.get("/{document_id}", response_model=PublicVerifyDocumentResponse)
def verify_document_public(
    document_id: UUID,
    db: Session = Depends(get_db),
):
    obj = (
        db.query(DigitalObject)
        .options(joinedload(DigitalObject.owner))
        .filter(DigitalObject.id == document_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Document not found")

    h = obj.sha256_hash or ""
    if len(h) >= 14:
        hash_short = f"{h[:8]}…{h[-6:]}"
    else:
        hash_short = h

    base = settings.PUBLIC_VERIFY_BASE_URL.rstrip("/")
    verify_url = f"{base}/verify/doc/{document_id}"
    wallet = obj.owner_wallet_address or (obj.owner.wallet_address if obj.owner else None)
    authentic = is_ledger_registered_status(obj.status) and bool(obj.blockchain_tx_hash)
    trust = _trust_chain_snapshot(db, obj.id)
    authentic = authentic and trust.get("trust_chain_status") != "BROKEN"

    return PublicVerifyDocumentResponse(
        document_id=obj.id,
        status=obj.status,
        owner_email=obj.owner.email if obj.owner else None,
        owner_wallet_address=wallet,
        registration_timestamp=obj.blockchain_registered_at or obj.created_at,
        sha256_hash=h,
        hash_short=hash_short,
        verify_url=verify_url,
        is_authentic=authentic,
        trust_chain_status=trust.get("trust_chain_status"),
        trust_chain_reason=trust.get("trust_chain_reason"),
        trust_chain_tx_hash=trust.get("trust_chain_tx_hash"),
        trust_chain_tx_explorer_url=trust.get("trust_chain_tx_explorer_url"),
        registered_hash=trust.get("registered_hash"),
        current_hash=trust.get("current_hash"),
        registered_original_available=bool(trust.get("registered_original_available")),
        registered_original_hash=trust.get("registered_original_hash"),
        tx_hash=obj.blockchain_tx_hash,
        tx_explorer_url=make_tx_explorer_url(obj.blockchain_tx_hash),
        file_name=obj.file_name,
        mime_type=obj.mime_type,
        size_bytes=obj.size_bytes,
        file_preview_url=f"{settings.API_V1_STR}/verify/{document_id}/file",
        registered_original_preview_url=(
            f"{settings.API_V1_STR}/verify/{document_id}/registered-original"
            if trust.get("registered_original_available")
            else None
        ),
    )


@router.get("/{document_id}/file")
def verify_document_public_file(
    document_id: UUID,
    db: Session = Depends(get_db),
):
    obj = db.query(DigitalObject).filter(DigitalObject.id == document_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Document not found")
    if not (is_ledger_registered_status(obj.status) and bool(obj.blockchain_tx_hash)):
        raise HTTPException(status_code=403, detail="Public file preview is not available for this document")
    try:
        storage = _storage_for_obj(obj)
        stream = storage.get_stream(obj.storage_key)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found in storage")
    filename = obj.file_name or f"{document_id}"
    mime = obj.mime_type or "application/octet-stream"
    return StreamingResponse(
        stream,
        media_type=mime,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/{document_id}/registered-original")
def verify_document_registered_original(
    document_id: UUID,
    db: Session = Depends(get_db),
):
    obj = db.query(DigitalObject).filter(DigitalObject.id == document_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Document not found")
    if not (is_ledger_registered_status(obj.status) and bool(obj.blockchain_tx_hash)):
        raise HTTPException(status_code=403, detail="Public original preview is not available for this document")
    original = _registered_original_snapshot(db, document_id)
    if not original:
        raise HTTPException(status_code=404, detail="Registered original not found")
    try:
        storage = get_storage_backend(str(original["storage_backend"]))
        stream = storage.get_stream(str(original["storage_key"]))
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Original file not found in storage")
    return StreamingResponse(
        stream,
        media_type=str(original["mime_type"] or "application/pdf"),
        headers={"Content-Disposition": f'inline; filename="{original["file_name"] or "registered_original.pdf"}"'},
    )
