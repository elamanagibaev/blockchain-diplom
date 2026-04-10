from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db
from app.models.blockchain_event import BlockchainEvent
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.schemas.blockchain import BlockchainAction, BlockchainEventRead, BlockchainObject
from app.services.blockchain_service import BlockchainService
from app.utils.block_explorer import make_tx_explorer_url

router = APIRouter(prefix="/blockchain", tags=["blockchain"])


@router.get("/events", response_model=list[BlockchainEventRead])
def list_blockchain_events(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Global blockchain journal: REGISTER and TRANSFER events."""
    events = (
        db.query(BlockchainEvent)
        .options(joinedload(BlockchainEvent.digital_object), joinedload(BlockchainEvent.initiator))
        .order_by(BlockchainEvent.timestamp.desc())
        .all()
    )
    return [
        BlockchainEventRead(
            id=str(e.id),
            action_type=e.action_type,
            document_id=str(e.document_id),
            document_file_name=e.digital_object.file_name if e.digital_object else None,
            timestamp=e.timestamp,
            tx_hash=e.tx_hash,
            from_wallet=e.from_wallet,
            to_wallet=e.to_wallet,
            initiator_user_id=str(e.initiator_user_id) if e.initiator_user_id else None,
            initiator_email=e.initiator.email if e.initiator else None,
            tx_explorer_url=make_tx_explorer_url(e.tx_hash),
        )
        for e in events
    ]


@router.get("/object/{object_id}", response_model=BlockchainObject | None)
def get_object(
    object_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    data = BlockchainService(db).get_object(object_id)
    if not data:
        return None
    # Hardhat returns timestamp as int seconds; FastAPI will parse if we convert.
    from datetime import datetime, timezone

    return BlockchainObject(
        object_id=data["object_id"],
        file_hash=data["file_hash"],
        owner=str(data["owner"]),
        registered_at=datetime.fromtimestamp(int(data["registered_at"]), tz=timezone.utc),
        metadata_uri=data["metadata_uri"],
        current_status=data["current_status"],
        exists=bool(data["exists"]),
    )


@router.get("/object/{object_id}/history", response_model=list[BlockchainAction])
def get_history(
    object_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    actions = BlockchainService(db).get_actions(object_id)
    from datetime import datetime, timezone

    return [
        BlockchainAction(
            action_type=a["action_type"],
            timestamp=datetime.fromtimestamp(int(a["timestamp"]), tz=timezone.utc),
            actor=str(a["actor"]),
            details=a.get("details"),
        )
        for a in actions
    ]


@router.get("/tx/{tx_hash}")
def get_tx(tx_hash: str):
    return {"tx_hash": tx_hash, "explorer_url": f"https://example.local/tx/{tx_hash}"}

