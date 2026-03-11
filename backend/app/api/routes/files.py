from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.files import (
    ActionHistoryItem,
    DigitalObjectCreateResponse,
    DigitalObjectRead,
    DigitalObjectWithHistory,
    Metrics,
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
        objs = [o for o in objs if ql in o.file_name.lower() or ql in o.sha256_hash]
    return [
        DigitalObjectRead(
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
            storage_key=o.storage_key,
        )
        for o in objs
    ]


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
    return DigitalObjectRead(
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
        owner_id=obj.owner_id,
        storage_key=obj.storage_key,
    )


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
    return DigitalObjectWithHistory(
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
        owner_id=obj.owner_id,
        storage_key=obj.storage_key,
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

