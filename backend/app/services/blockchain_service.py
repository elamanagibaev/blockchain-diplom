from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.blockchain.client import BlockchainClient, BlockchainNotConfiguredError
from app.constants.document_events import DocumentEventAction
from app.constants.lifecycle import LifecycleStatus
from app.models.blockchain_event import BlockchainEvent
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.services.auth_service import ensure_user_wallet
from app.services.document_event_service import DocumentEventService
from app.services.pipeline_service import PipelineService


class BlockchainService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _client(self) -> BlockchainClient:
        try:
            return BlockchainClient()
        except BlockchainNotConfiguredError as e:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))

    def register_on_chain(
        self,
        obj: DigitalObject,
        owner: User,
        *,
        initiated_by: User | None = None,
    ) -> str:
        if obj.status != LifecycleStatus.APPROVED.value:
            raise HTTPException(
                status_code=400,
                detail=f"Документ должен пройти полное согласование (APPROVED), текущий статус: {obj.status}",
            )
        if obj.blockchain_tx_hash:
            raise HTTPException(
                status_code=400,
                detail="Документ уже зарегистрирован в блокчейне. Повторная регистрация невозможна.",
            )

        owner = ensure_user_wallet(owner, self.db)
        owner_wallet = owner.wallet_address
        actor = initiated_by or owner
        if not owner_wallet:
            raise HTTPException(status_code=400, detail="User wallet_address is required for on-chain registration")

        client = self._client()

        if client.hash_exists(obj.sha256_hash):
            raise HTTPException(
                status_code=400,
                detail="Файл с таким хэшем уже зарегистрирован в блокчейне другим пользователем.",
            )

        object_id = str(obj.id)
        metadata_uri = f"offchain://digital_objects/{obj.id}"
        now = datetime.now(timezone.utc)

        try:
            tx_hash = client.register_object(object_id, obj.sha256_hash, owner_wallet, metadata_uri, "REGISTERED_ON_CHAIN")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Ошибка блокчейн-транзакции: {str(e)}")

        obj.status = LifecycleStatus.REGISTERED_ON_CHAIN.value
        obj.blockchain_registered_at = now
        obj.owner_wallet_address = owner_wallet
        obj.blockchain_object_id = object_id
        obj.blockchain_tx_hash = tx_hash

        self.db.add(
            BlockchainEvent(
                action_type="REGISTER",
                document_id=obj.id,
                timestamp=now,
                tx_hash=tx_hash,
                from_wallet=None,
                to_wallet=owner_wallet,
                initiator_user_id=actor.id,
            )
        )
        DocumentEventService(self.db).record(
            document_id=obj.id,
            user_id=actor.id,
            action=DocumentEventAction.REGISTER.value,
            metadata={
                "kind": "final_on_chain_registration",
                "tx_hash": tx_hash,
                "blockchain_object_id": object_id,
                "metadata_uri": metadata_uri,
                "owner_wallet": owner_wallet,
            },
        )
        PipelineService(self.db).on_registered_on_chain(obj, actor.id, tx_hash)
        self.db.commit()
        self.db.refresh(obj)
        return tx_hash

    def get_object(self, object_id: str):
        client = self._client()
        return client.get_object(object_id)

    def get_actions(self, object_id: str):
        client = self._client()
        return client.get_actions(object_id)

