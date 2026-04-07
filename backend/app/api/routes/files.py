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
from app.services.approval_workflow_service import ApprovalWorkflowService
from app.services.blockchain_service import BlockchainService
from app.services.file_service import FileService
from app.services.pipeline_service import PipelineService

router = APIRouter(prefix="/files", tags=["files"])


class StudentWalletBody(BaseModel):
    student_wallet_address: str


def _require_roles(user: User, allowed: tuple[str, ...]) -> None:
    if user.role == "admin":
        return
    if user.role not in allowed:
        raise HTTPException(status_code=403, detail="Недостаточно прав для этой операции")


@router.post("/upload", response_model=DigitalObjectCreateResponse)
async def upload_file(
    description: str | None = Form(default=None),
    upload_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    desc = (description or "").strip()
    if not desc:
        raise HTTPException(status_code=422, detail="Введите название документа")
    obj = FileService(db).register_file(current_user, upload_file, desc)
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
    """Подача заявки на регистрацию в блокчейне (одобрение администратором)."""
    obj = FileService(db).submit_for_registration(current_user, obj_id)
    return {"message": "Заявка на регистрацию отправлена", "status": obj.status}


@router.post("/{obj_id}/approve/department")
def approve_department_pipeline(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Этап 3 — подтверждение кафедры (роль department или admin)."""
    _require_roles(current_user, ("department",))
    obj = FileService(db).get_object(current_user, obj_id)
    ApprovalWorkflowService(db).approve_current_stage(obj, current_user)
    db.refresh(obj)
    return {"message": "Этап кафедры подтверждён", "status": obj.status}


@router.post("/{obj_id}/approve/deanery")
def approve_deanery_pipeline(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Этап 3 — подтверждение деканата (роли dean / registrar или admin)."""
    _require_roles(current_user, ("dean", "registrar"))
    obj = FileService(db).get_object(current_user, obj_id)
    ApprovalWorkflowService(db).approve_current_stage(obj, current_user)
    db.refresh(obj)
    return {"message": "Этап деканата подтверждён", "status": obj.status}


@router.post("/{obj_id}/register")
def register_document_on_chain(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Этап 4 — финальная регистрация в смарт-контракте (только admin)."""
    obj = (
        db.query(DigitalObject)
        .options(joinedload(DigitalObject.owner))
        .filter(DigitalObject.id == obj_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    if obj.status != LifecycleStatus.APPROVED.value:
        raise HTTPException(
            status_code=400,
            detail=f"Документ должен быть APPROVED после согласований, текущий статус: {obj.status}",
        )
    owner = obj.owner
    if not owner:
        raise HTTPException(status_code=400, detail="Document has no owner")
    tx_hash = BlockchainService(db).register_on_chain(obj, owner, initiated_by=current_admin)
    try:
        FileService(db).migrate_file_to_minio(obj)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"tx_hash": tx_hash, "object_id": obj.blockchain_object_id, "status": "REGISTERED_ON_CHAIN"}


@router.post("/{obj_id}/assign-owner")
def assign_owner_pipeline(
    obj_id: UUID,
    body: StudentWalletBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Этап 5 — привязка кошелька выпускника."""
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
        .order_by(DocumentEvent.timestamp.desc())
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
