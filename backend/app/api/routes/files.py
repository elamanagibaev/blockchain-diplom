from collections import defaultdict
from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, Body
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.blockchain_event import BlockchainEvent
from app.models.user import User
from app.schemas.files import (
    DigitalObjectCreateResponse,
    DigitalObjectRead,
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
