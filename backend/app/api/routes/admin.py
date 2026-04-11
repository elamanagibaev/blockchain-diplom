import logging
from uuid import UUID
from typing import List

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from app.api.deps import get_current_admin, get_db
from app.models.digital_object import DigitalObject
from app.models.document_event import DocumentEvent
from app.models.university import University
from app.models.user import User
from app.schemas.files import DigitalObjectRead, DocumentEventJournalRead
from app.schemas.university import UniversityCreate, UniversityRead
from app.schemas.user import UserRead
from app.constants.document_events import DocumentEventAction
from app.constants.lifecycle import LifecycleStatus
from app.services.blockchain_service import BlockchainService
from app.services.diploma_automation_service import DiplomaAutomationService
from app.services.document_event_service import DocumentEventService
from app.services.file_service import FileService
from app.utils.block_explorer import make_tx_explorer_url

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin", tags=["admin"])


class UserUpdateRequest(BaseModel):
    is_active: bool | None = None
    role: str | None = None
    university_id: int | None = None


def _doc_to_read(o) -> DigitalObjectRead:
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
        owner_email=o.owner.email if o.owner else None,
        uploaded_by_id=getattr(o, "uploaded_by_id", None),
        uploaded_by_email=(o.uploaded_by.email if getattr(o, "uploaded_by", None) else None),
        uploaded_by_wallet_address=(
            o.uploaded_by.wallet_address if getattr(o, "uploaded_by", None) else None
        ),
        title=o.title or o.file_name,
        document_type=o.document_type,
        storage_key=o.storage_key,
        blockchain_registered_at=o.blockchain_registered_at,
        tx_explorer_url=make_tx_explorer_url(getattr(o, "blockchain_tx_hash", None)),
    )


@router.get("/journal/document-events", response_model=List[DocumentEventJournalRead])
def list_journal_document_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin),
    limit: int = Query(500, ge=1, le=2000),
):
    """Глобальный журнал document_events для страницы /explorer (только администратор)."""
    rows = (
        db.query(DocumentEvent)
        .options(joinedload(DocumentEvent.document), joinedload(DocumentEvent.user))
        .order_by(DocumentEvent.timestamp.desc())
        .limit(limit)
        .all()
    )
    return [
        DocumentEventJournalRead(
            id=r.id,
            document_id=r.document_id,
            action=r.action,
            timestamp=r.timestamp,
            user_id=r.user_id,
            user_email=r.user.email if r.user else None,
            metadata=r.event_metadata,
            document_file_name=r.document.file_name if r.document else None,
        )
        for r in rows
    ]


@router.get("/documents/pending", response_model=List[DigitalObjectRead])
def list_pending_registrations(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """List documents awaiting final on-chain registration (after full workflow approval)."""
    objs = FileService(db).list_pending_registrations()
    return [_doc_to_read(o) for o in objs]


@router.post("/documents/{obj_id}/approve")
def approve_registration(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Approve document: register on blockchain, update status to REGISTERED_ON_CHAIN."""
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
            detail=f"Document must be DEAN_APPROVED after dean stage, got {obj.status}",
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
    # Сначала фиксируем on-chain + document_events + blockchain_events отдельным commit,
    # чтобы при сбое MinIO-миграции записи журнала не терялись из-за rollback всей транзакции.
    tx_hash = BlockchainService(db).register_on_chain(
        obj, owner, initiated_by=current_admin, commit=True
    )
    logger.info(
        "admin approve_registration: on-chain commit ok doc_id=%s tx_hash=%s",
        obj_id,
        tx_hash,
    )
    try:
        FileService(db).migrate_file_to_minio(obj)
        db.commit()
        logger.info("admin approve_registration: minio migrate committed doc_id=%s", obj_id)
    except FileNotFoundError as e:
        logger.warning(
            "admin approve_registration: minio migrate skipped (file missing) doc_id=%s: %s",
            obj_id,
            e,
        )
    except Exception:
        logger.exception(
            "admin approve_registration: minio migrate failed after on-chain commit doc_id=%s — rollback только изменений миграции",
            obj_id,
        )
        db.rollback()
    return {
        "tx_hash": tx_hash,
        "object_id": obj.blockchain_object_id,
        "status": "REGISTERED_ON_CHAIN",
        "tx_explorer_url": make_tx_explorer_url(tx_hash),
    }


@router.post("/documents/{obj_id}/reject")
def reject_registration(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Reject document: set status to REJECTED."""
    obj = db.query(DigitalObject).filter(DigitalObject.id == obj_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    if obj.status == LifecycleStatus.UNDER_REVIEW.value:
        raise HTTPException(
            status_code=403,
            detail="Отклонение на этапе согласования выполняет деканат (POST /approvals/documents/{id}/reject).",
        )
    if obj.status not in (
        LifecycleStatus.APPROVED.value,
        LifecycleStatus.DEAN_APPROVED.value,
    ):
        raise HTTPException(
            status_code=400,
            detail=f"Document must be APPROVED or DEAN_APPROVED for admin reject, got {obj.status}",
        )
    obj.status = LifecycleStatus.REJECTED.value
    db.add(obj)
    DocumentEventService(db).record(
        document_id=obj.id,
        user_id=current_admin.id,
        action=DocumentEventAction.APPROVAL.value,
        metadata={"decision": "rejected"},
    )
    db.commit()
    logger.info("admin reject_registration: committed doc_id=%s", obj_id)
    db.refresh(obj)
    return {"message": "Заявка отклонена", "status": "REJECTED"}


@router.get("/users", response_model=List[UserRead])
def list_users(db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    users = db.query(User).options(joinedload(User.university)).order_by(User.created_at.desc()).all()
    return [UserRead.from_orm(u) for u in users]


@router.patch("/users/{user_id}")
def update_user(
    user_id: UUID,
    payload: UserUpdateRequest = Body(...),
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    updates = payload.model_dump(exclude_unset=True)
    if "is_active" in updates:
        user.is_active = updates["is_active"]
    if "role" in updates:
        user.role = updates["role"]
    if "university_id" in updates:
        user.university_id = updates["university_id"]
    db.add(user)
    db.commit()
    user = db.query(User).options(joinedload(User.university)).filter(User.id == user_id).first()
    return UserRead.from_orm(user)


@router.get("/universities", response_model=List[UniversityRead])
def list_universities(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    return db.query(University).order_by(University.id.asc()).all()


@router.post("/universities", response_model=UniversityRead)
def create_university(
    body: UniversityCreate,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="Укажите название вуза")
    exists = db.query(University).filter(University.name == name).first()
    if exists:
        raise HTTPException(status_code=409, detail="Вуз с таким названием уже существует")
    short = (body.short_name or "").strip() or None
    u = University(name=name, short_name=short, is_active=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u
