from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.blockchain.client import BlockchainClient, BlockchainNotConfiguredError
from app.models.action_history import ActionHistory
from app.models.digital_object import DigitalObject
from app.models.user import User


class BlockchainService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _client(self) -> BlockchainClient:
        try:
            return BlockchainClient()
        except BlockchainNotConfiguredError as e:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))

    def register_on_chain(self, obj: DigitalObject, actor: User) -> str:
        client = self._client()
        owner_wallet = actor.wallet_address
        if not owner_wallet:
            raise HTTPException(status_code=400, detail="User wallet_address is required for on-chain registration")

        object_id = str(obj.id)
        metadata_uri = f"offchain://digital_objects/{obj.id}"
        tx_hash = client.register_object(object_id, obj.sha256_hash, owner_wallet, metadata_uri, obj.status)

        obj.blockchain_object_id = object_id
        obj.blockchain_tx_hash = tx_hash

        self.db.add(
            ActionHistory(
                digital_object_id=obj.id,
                action_type="REGISTER_ON_CHAIN",
                performed_by_id=actor.id,
                performed_at=datetime.now(timezone.utc),
                details="On-chain registration",
                blockchain_tx_hash=tx_hash,
            )
        )
        self.db.commit()
        self.db.refresh(obj)
        return tx_hash

    def get_object(self, object_id: str):
        client = self._client()
        return client.get_object(object_id)

    def get_actions(self, object_id: str):
        client = self._client()
        return client.get_actions(object_id)

