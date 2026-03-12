from uuid import UUID
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_admin, get_db
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.schemas.files import DigitalObjectRead
from app.schemas.user import UserRead
from app.services.blockchain_service import BlockchainService
from app.services.file_service import FileService

router = APIRouter(prefix="/admin", tags=["admin"])


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
        title=o.title or o.file_name,
        document_type=o.document_type,
        storage_key=o.storage_key,
        blockchain_registered_at=o.blockchain_registered_at,
    )


@router.get("/documents/pending", response_model=List[DigitalObjectRead])
def list_pending_registrations(
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """List documents awaiting admin approval for blockchain registration."""
    objs = FileService(db).list_pending_registrations()
    return [_doc_to_read(o) for o in objs]


@router.post("/documents/{obj_id}/approve")
def approve_registration(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_admin: User = Depends(get_current_admin),
):
    """Approve document: register on blockchain, update status to REGISTERED_ON_CHAIN."""
    from sqlalchemy.orm import joinedload

    obj = (
        db.query(DigitalObject)
        .options(joinedload(DigitalObject.owner))
        .filter(DigitalObject.id == obj_id)
        .first()
    )
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    if obj.status != "PENDING_APPROVAL":
        raise HTTPException(
            status_code=400,
            detail=f"Document must be PENDING_APPROVAL, got {obj.status}",
        )
    owner = obj.owner
    if not owner:
        raise HTTPException(status_code=400, detail="Document has no owner")
    tx_hash = BlockchainService(db).register_on_chain(obj, owner)
    # После регистрации в блокчейне переносим файл в MinIO (если MinIO включён)
    try:
        FileService(db).migrate_file_to_minio(obj)
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"tx_hash": tx_hash, "object_id": obj.blockchain_object_id, "status": "REGISTERED_ON_CHAIN"}


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
    if obj.status != "PENDING_APPROVAL":
        raise HTTPException(
            status_code=400,
            detail=f"Document must be PENDING_APPROVAL, got {obj.status}",
        )
    obj.status = "REJECTED"
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return {"message": "Заявка отклонена", "status": "REJECTED"}


@router.get("/users", response_model=List[UserRead])
def list_users(db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return users


@router.patch("/users/{user_id}")
def update_user(user_id: UUID, is_active: bool | None = None, role: str | None = None,
                db: Session = Depends(get_db), current_admin: User = Depends(get_current_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if is_active is not None:
        user.is_active = is_active
    if role is not None:
        user.role = role
    db.add(user)
    db.commit()
    db.refresh(user)
    return UserRead.from_orm(user)
