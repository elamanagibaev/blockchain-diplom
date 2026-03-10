from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.schemas.blockchain import BlockchainAction, BlockchainObject
from app.services.blockchain_service import BlockchainService

router = APIRouter(prefix="/blockchain", tags=["blockchain"])


@router.post("/register/{obj_id}")
def register_object(
    obj_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    obj = db.query(DigitalObject).filter(DigitalObject.id == obj_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Object not found")
    if current_user.role != "admin" and obj.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    tx_hash = BlockchainService(db).register_on_chain(obj, current_user)
    return {"tx_hash": tx_hash, "object_id": obj.blockchain_object_id}


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

