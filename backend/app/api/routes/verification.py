from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_db, get_optional_user
from app.core.config import get_settings
from app.models.blockchain_event import BlockchainEvent
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.schemas.verification import FileVerificationResult, PublicVerifyDocumentResponse
from app.services.pipeline_service import PipelineService
from app.services.verification_service import VerificationService
from app.utils.sanitizer import sanitize_hash

router = APIRouter(prefix="/verify", tags=["verification"])
settings = get_settings()


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
            blockchain_registered_at=None,
            blockchain_object_id=None,
            status=None,
            integrity_status="INVALID_HASH",
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
    return FileVerificationResult(
        verification_status=status,
        is_verified=(status == "VALID"),
        digital_object_id=obj.id if obj else None,
        registered_at=obj.created_at if obj else None,
        registration_timestamp=reg_ts,
        owner_id=obj.owner_id if obj else None,
        owner_email=owner_email,
        owner_wallet_address=wallet,
        file_name=obj.file_name if obj else None,
        description=obj.description if obj else None,
        transaction_hash=obj.blockchain_tx_hash if obj else None,
        blockchain_registered_at=obj.blockchain_registered_at if obj else None,
        blockchain_object_id=str(obj.blockchain_object_id) if obj and obj.blockchain_object_id else None,
        status=obj.status if obj else None,
        integrity_status=integrity_map[status],
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
    authentic = obj.status == "REGISTERED_ON_CHAIN" and bool(obj.blockchain_tx_hash)

    return PublicVerifyDocumentResponse(
        document_id=obj.id,
        status=obj.status,
        owner_email=obj.owner.email if obj.owner else None,
        owner_wallet_address=wallet,
        registration_timestamp=obj.blockchain_registered_at or obj.created_at,
        hash_short=hash_short,
        verify_url=verify_url,
        is_authentic=authentic,
    )
