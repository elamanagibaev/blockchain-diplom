from collections import defaultdict
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Body
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_admin, get_current_user, get_db
from app.constants.lifecycle import LifecycleStatus
from app.models.blockchain_event import BlockchainEvent
from app.models.digital_object import DigitalObject
from app.models.document_event import DocumentEvent
from app.models.user import User
from app.schemas.files import (
    DigitalObjectCreateResponse,
    DigitalObjectRead,
    DocumentEventRead,
    Metrics,
)
from app.services.blockchain_service import BlockchainService
from app.services.diploma_automation_service import DiplomaAutomationService
from app.services.file_service import FileService
from app.services.pipeline_service import PipelineService
from app.utils.block_explorer import make_tx_explorer_url

router = APIRouter(prefix="/files", tags=["files"])


class StudentWalletBody(BaseModel):
    student_wallet_address: str


@router.post("/upload", response_model=DigitalObjectCreateResponse)
async def upload_file(
    description: str | None = Form(default=None),
    student_wallet: str | None = Form(default=None),
    upload_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Упрощённая модель: загрузку диплома выполняет только кафедра (роль department).
    if current_user.role != "department":
        raise HTTPException(
            status_code=403,
            detail="Загрузка документа доступна только роли department (кафедра).",
        )
    desc = (description or "").strip()
    if not desc:
        raise HTTPException(status_code=422, detail="Введите название документа")
    if not (student_wallet or "").strip():
        raise HTTPException(status_code=422, detail="Укажите student_wallet (кошелёк выпускника)")
    obj = FileService(db).register_file(current_user, upload_file, desc, student_wallet=student_wallet)
    return DigitalObjectCreateResponse(
        id=obj.id,
        file_name=obj.file_name,
        mime_type=obj.mime_type,
        size_bytes=obj.size_bytes,
        description=obj.description,
        sha256_hash=obj.sha256_hash,
        status=obj.status,
        created_at=obj.created_at,
        blockchain_object_id=obj.blockchain_object_id,
        blockchain_tx_hash=obj.blockchain_tx_hash,
        student_wallet_address=getattr(obj, "student_wallet_address", None),
        tx_explorer_url=make_tx_explorer_url(getattr(obj, "blockchain_tx_hash", None)),
    )


class FileStatusSyncResponse(BaseModel):
    id: UUID
    status: str
    blockchain_tx_hash: str | None = None
    student_wallet_address: str | None = None
    automation_attempted: bool = False
    tx_explorer_url: str | None = None


@router.patch("/{obj_id}/status", response_model=FileStatusSyncResponse)
def patch_file_status(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Polling/retry: при зависшем DEAN_APPROVED повторяет автоматизацию этапов 4–5."""
    fs = FileService(db)
    obj = fs.get_object(current_user, obj_id, require_owner=True)
    if current_user.role not in ("department", "admin"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    attempted = False
    auto = DiplomaAutomationService(db)
    if obj.status in (LifecycleStatus.DEAN_APPROVED.value, LifecycleStatus.APPROVED.value) and not obj.blockchain_tx_hash:
        attempted = True
        auto.finalize_after_dean_if_ready(obj, current_user)
        db.refresh(obj)
    elif obj.status == LifecycleStatus.REGISTERED.value and obj.blockchain_tx_hash:
        attempted = auto.complete_owner_assign_if_pending(obj, current_user)
        db.refresh(obj)
    return FileStatusSyncResponse(
        id=obj.id,
        status=obj.status,
        blockchain_tx_hash=obj.blockchain_tx_hash,
        student_wallet_address=getattr(obj, "student_wallet_address", None),
        automation_attempted=attempted,
        tx_explorer_url=make_tx_explorer_url(getattr(obj, "blockchain_tx_hash", None)),
    )


def _latest_transfer_wallets(db: Session, doc_ids: list[UUID]) -> dict[UUID, tuple[str | None, str | None]]:
    """Последнее событие TRANSFER по каждому документу: (from_wallet, to_wallet)."""
    if not doc_ids:
        return {}
    events = (
        db.query(BlockchainEvent)
        .filter(
            BlockchainEvent.document_id.in_(doc_ids),
            BlockchainEvent.action_type == "TRANSFER",
        )
        .all()
    )
    by_doc: dict[UUID, list[BlockchainEvent]] = defaultdict(list)
    for e in events:
        by_doc[e.document_id].append(e)
    out: dict[UUID, tuple[str | None, str | None]] = {}
    for doc_id, evs in by_doc.items():
        latest = max(evs, key=lambda x: x.timestamp)
        out[doc_id] = (latest.from_wallet, latest.to_wallet)
    return out


def _to_read(
    o,
    owner_email: str | None = None,
    last_transfer: tuple[str | None, str | None] | None = None,
) -> DigitalObjectRead:
    fr, to = (None, None)
    if last_transfer:
        fr, to = last_transfer
    hist = getattr(o, "stage_history", None)
    if not isinstance(hist, list):
        hist = []
    ps = getattr(o, "processing_stage", None)
    if ps is None:
        ps = PipelineService.compute_processing_stage(o)
    return DigitalObjectRead(
        id=o.id,
        file_name=o.file_name,
        mime_type=o.mime_type,
        size_bytes=o.size_bytes,
        description=o.description,
        sha256_hash=o.sha256_hash,
        status=o.status,
        created_at=o.created_at,
        blockchain_object_id=o.blockchain_object_id,
        blockchain_tx_hash=o.blockchain_tx_hash,
        owner_id=o.owner_id,
        owner_wallet_address=o.owner_wallet_address or (o.owner.wallet_address if o.owner else None),
        owner_email=owner_email or (o.owner.email if o.owner else None),
        uploaded_by_id=getattr(o, "uploaded_by_id", None),
        uploaded_by_email=(o.uploaded_by.email if getattr(o, "uploaded_by", None) else None),
        uploaded_by_wallet_address=(
            o.uploaded_by.wallet_address if getattr(o, "uploaded_by", None) else None
        ),
        title=o.title or o.file_name,
        document_type=o.document_type,
        storage_key=o.storage_key,
        blockchain_registered_at=o.blockchain_registered_at,
        last_transfer_from_wallet=fr,
        last_transfer_to_wallet=to,
        processing_stage=ps,
        stage_history=hist,
        department_approved_at=getattr(o, "department_approved_at", None),
        deanery_approved_at=getattr(o, "deanery_approved_at", None),
        ai_check_status=getattr(o, "ai_check_status", None) or "skipped",
        student_wallet_address=getattr(o, "student_wallet_address", None),
        tx_explorer_url=make_tx_explorer_url(getattr(o, "blockchain_tx_hash", None)),
    )


@router.get("", response_model=list[DigitalObjectRead])
def list_files(
    q: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    objs = FileService(db).list_objects(current_user)
    if status:
        objs = [o for o in objs if o.status == status]
    if q:
        ql = q.lower()
        objs = [o for o in objs if ql in (o.file_name or "").lower() or ql in (o.sha256_hash or "")]
    return [_to_read(o) for o in objs]


@router.get("/global", response_model=list[DigitalObjectRead])
def list_global(
    q: Optional[str] = None,
    status: Optional[str] = None,
    owner_wallet: Optional[str] = None,
    tx_hash: Optional[str] = None,
    sort_by: Optional[str] = "created_at",
    sort_order: Optional[str] = "desc",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Глобальный реестр патентных документов: поиск, фильтры и сортировка."""
    objs = FileService(db).list_objects_global(
        q_search=q,
        status_filter=status,
        owner_wallet=owner_wallet,
        tx_hash=tx_hash,
        sort_by=sort_by or "created_at",
        sort_order=sort_order or "desc",
    )
    transfers = _latest_transfer_wallets(db, [o.id for o in objs])
    return [_to_read(o, last_transfer=transfers.get(o.id)) for o in objs]


@router.get("/metrics", response_model=Metrics)
def files_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = FileService(db).metrics(current_user)
    return data


@router.post("/{obj_id}/submit-for-registration")
def submit_for_registration(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Подача на единственный этап согласования — проверка деканатом (далее APPROVED → on-chain у admin)."""
    obj = FileService(db).submit_for_registration(current_user, obj_id)
    return {"message": "Заявка на регистрацию отправлена", "status": obj.status}


@router.post("/{obj_id}/register")
def register_document_on_chain(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Резерв: ручная финализация, если автоматика после декана не сработала (есть student_wallet)."""
    obj = (
        db.query(DigitalObject)
        .options(joinedload(DigitalObject.owner))
        .filter(DigitalObject.id == obj_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    if obj.status not in (LifecycleStatus.DEAN_APPROVED.value, LifecycleStatus.APPROVED.value):
        raise HTTPException(
            status_code=400,
            detail=f"Документ должен быть DEAN_APPROVED после согласования деканата, текущий статус: {obj.status}",
        )
    owner = obj.owner
    if not owner:
        raise HTTPException(status_code=400, detail="Document has no owner")
    sw = (getattr(obj, "student_wallet_address", None) or "").strip()
    if sw:
        DiplomaAutomationService(db).finalize_after_dean_if_ready(obj, current_admin)
        db.refresh(obj)
        return {
            "tx_hash": obj.blockchain_tx_hash,
            "object_id": obj.blockchain_object_id,
            "status": obj.status,
            "tx_explorer_url": make_tx_explorer_url(obj.blockchain_tx_hash),
        }
    tx_hash = BlockchainService(db).register_on_chain(obj, owner, initiated_by=current_admin, commit=False)
    try:
        FileService(db).migrate_file_to_minio(obj)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {
        "tx_hash": tx_hash,
        "object_id": obj.blockchain_object_id,
        "status": obj.status,
        "tx_explorer_url": make_tx_explorer_url(tx_hash),
    }


@router.post("/{obj_id}/assign-owner")
def assign_owner_pipeline(
    obj_id: UUID,
    body: StudentWalletBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Привязка кошелька выпускника после on-chain (владелец документа или admin)."""
    obj = FileService(db).assign_student_wallet(current_user, obj_id, body.student_wallet_address)
    return {
        "message": "Кошелёк привязан",
        "student_wallet_address": obj.student_wallet_address,
        "status": obj.status,
    }


@router.get("/{obj_id}/events", response_model=list[DocumentEventRead])
def list_document_events(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Журнал событий документа (владелец или администратор)."""
    FileService(db).get_object(current_user, obj_id, require_owner=True)
    rows = (
        db.query(DocumentEvent)
        .filter(DocumentEvent.document_id == obj_id)
        .order_by(DocumentEvent.timestamp.asc())
        .limit(100)
        .all()
    )
    return [
        DocumentEventRead(
            id=r.id,
            action=r.action,
            timestamp=r.timestamp,
            user_id=r.user_id,
            metadata=r.event_metadata,
        )
        for r in rows
    ]


@router.get("/{obj_id}", response_model=DigitalObjectRead)
def get_file(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = FileService(db).get_object(current_user, obj_id)
    return _to_read(obj)


@router.post("/{obj_id}/transfer")
def transfer_document(
    obj_id: UUID,
    to_wallet_address: str = Body(..., embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = FileService(db).transfer_document(current_user, obj_id, to_wallet_address)
    return {"message": "Документ передан", "object_id": str(obj.id), "new_owner_wallet": obj.owner_wallet_address}


@router.get("/{obj_id}/download")
def download_file(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Потоковая выдача файла из хранилища (MinIO или локально). Требуется авторизация."""
    try:
        stream, filename, mime_type = FileService(db).get_download_stream(current_user, obj_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found in storage")
    return StreamingResponse(
        stream,
        media_type=mime_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )
