from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile, Body
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.files import (
    ActionHistoryItem,
    DigitalObjectCreateResponse,
    DigitalObjectRead,
    DigitalObjectWithHistory,
    Metrics,
    RecentActivityItem,
    RecentActivityResponse,
)
from app.services.file_service import FileService

router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload", response_model=DigitalObjectCreateResponse)
async def upload_file(
    description: str | None = Form(default=None),
    upload_file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = FileService(db).register_file(current_user, upload_file, description)
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


def _to_read(o, owner_email: str | None = None) -> DigitalObjectRead:
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Global patent/document registry - all documents from all users."""
    objs = FileService(db).list_objects_global(q_search=q, status_filter=status)
    return [_to_read(o) for o in objs]


@router.post("/{obj_id}/submit-for-registration")
def submit_for_registration(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """User submits document for admin approval to register on blockchain."""
    obj = FileService(db).submit_for_registration(current_user, obj_id)
    return {"message": "Заявка на регистрацию отправлена", "status": obj.status}


@router.get("/activity/recent", response_model=RecentActivityResponse)
def recent_activity(
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    actions = FileService(db).get_recent_activity(current_user, limit=limit)
    return RecentActivityResponse(
        actions=[
            RecentActivityItem(
                id=a["id"],
                action_type=a["action_type"],
                performed_at=a["performed_at"],
                file_name=a["file_name"],
                object_id=a["object_id"],
                details=a["details"],
            )
            for a in actions
        ]
    )


@router.get("/metrics", response_model=Metrics)
def files_metrics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = FileService(db).metrics(current_user)
    return data


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
    url = FileService(db).get_download_url(current_user, obj_id)
    return {"url": url}


@router.get("/{obj_id}/history", response_model=DigitalObjectWithHistory)
def get_file_history(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = FileService(db)
    obj = svc.get_object(current_user, obj_id)
    actions = svc.get_history(current_user, obj_id)
    base = _to_read(obj)
    return DigitalObjectWithHistory(
        **base.model_dump(),
        actions=[
            ActionHistoryItem(
                id=a.id,
                action_type=a.action_type,
                performed_at=a.performed_at,
                performed_by_id=a.performed_by_id,
                details=a.details,
                blockchain_tx_hash=a.blockchain_tx_hash,
            )
            for a in actions
        ],
    )

