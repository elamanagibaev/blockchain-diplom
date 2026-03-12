from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.blockchain.client import BlockchainClient, BlockchainNotConfiguredError
from app.models.action_history import ActionHistory
from app.models.blockchain_event import BlockchainEvent
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.services.auth_service import ensure_user_wallet
from app.services.audit_service import AuditService


class BlockchainService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _client(self) -> BlockchainClient:
        try:
            return BlockchainClient()
        except BlockchainNotConfiguredError as e:
            raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(e))

    def register_on_chain(self, obj: DigitalObject, actor: User) -> str:
        if obj.blockchain_tx_hash:
            raise HTTPException(
                status_code=400,
                detail="Документ уже зарегистрирован в блокчейне. Повторная регистрация невозможна.",
            )

        actor = ensure_user_wallet(actor, self.db)
        owner_wallet = actor.wallet_address
        if not owner_wallet:
            raise HTTPException(status_code=400, detail="User wallet_address is required for on-chain registration")

        try:
            client = self._client()
        except Exception as e:
            AuditService(self.db).log_blockchain_register_attempt(actor, obj.id, False, str(e))
            self.db.commit()
            raise

        if client.hash_exists(obj.sha256_hash):
            AuditService(self.db).log_blockchain_register_attempt(
                actor, obj.id, False, "Hash already registered in blockchain"
            )
            self.db.commit()
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
            AuditService(self.db).log_blockchain_register_attempt(actor, obj.id, False, str(e))
            self.db.commit()
            raise HTTPException(status_code=500, detail=f"Ошибка блокчейн-транзакции: {str(e)}")

        obj.status = "REGISTERED_ON_CHAIN"
        obj.blockchain_registered_at = now
        obj.owner_wallet_address = owner_wallet
        obj.blockchain_object_id = object_id
        obj.blockchain_tx_hash = tx_hash

        self.db.add(
            ActionHistory(
                digital_object_id=obj.id,
                action_type="REGISTER_ON_CHAIN",
                performed_by_id=actor.id,
                performed_at=now,
                details="On-chain registration",
                blockchain_tx_hash=tx_hash,
            )
        )
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
        AuditService(self.db).log_blockchain_register_attempt(actor, obj.id, True, f"tx: {tx_hash}")
        self.db.commit()
        self.db.refresh(obj)
        return tx_hash

    def get_object(self, object_id: str):
        client = self._client()
        return client.get_object(object_id)

    def get_actions(self, object_id: str):
        client = self._client()
        return client.get_actions(object_id)

