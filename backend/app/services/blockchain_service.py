from datetime import datetime, timezone

from app.utils.block_explorer import make_tx_explorer_url

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.blockchain.client import BlockchainClient, BlockchainNotConfiguredError
from app.constants.document_events import DocumentEventAction
from app.constants.lifecycle import LifecycleStatus, status_allows_on_chain_registration
from app.models.blockchain_event import BlockchainEvent
from app.models.digital_object import DigitalObject
from app.models.user import User
from web3 import Web3

from app.services.auth_service import ensure_user_wallet
from app.services.document_event_service import DocumentEventService
from app.services.pipeline_service import PipelineService


def _normalize_owner_wallet(addr: str) -> str:
    raw = (addr or "").strip()
    if len(raw) != 42 or not raw.startswith("0x"):
        raise HTTPException(status_code=400, detail="Некорректный адрес кошелька владельца on-chain (ожидается 0x + 40 hex)")
    try:
        return Web3.to_checksum_address(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Некорректный формат адреса кошелька")


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
        on_chain_owner_wallet: str | None = None,
        commit: bool = True,
        automatic: bool = False,
        workflow: str = "single_stage_dean",
    ) -> str:
        if not status_allows_on_chain_registration(obj.status):
            raise HTTPException(
                status_code=400,
                detail=f"Документ должен быть согласован деканатом (DEAN_APPROVED), текущий статус: {obj.status}",
            )
        # Упрощённый workflow: финальная запись только после подтверждения деканатом (метка времени).
        if not getattr(obj, "deanery_approved_at", None):
            raise HTTPException(
                status_code=400,
                detail="On-chain регистрация возможна только после подтверждения деканатом.",
            )
        if obj.blockchain_tx_hash:
            raise HTTPException(
                status_code=400,
                detail="Документ уже зарегистрирован в блокчейне. Повторная регистрация невозможна.",
            )

        actor = initiated_by or owner
        if on_chain_owner_wallet:
            owner_wallet = _normalize_owner_wallet(on_chain_owner_wallet)
        else:
            owner = ensure_user_wallet(owner, self.db)
            owner_wallet = owner.wallet_address
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

        obj.status = LifecycleStatus.REGISTERED.value
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
        doc_ts = now.isoformat()
        explorer = make_tx_explorer_url(tx_hash)
        DocumentEventService(self.db).record(
            document_id=obj.id,
            user_id=actor.id,
            action=DocumentEventAction.REGISTER.value,
            metadata={
                "step": "on_chain_registered",
                "automatic": automatic,
                "workflow": workflow,
                "tx_hash": tx_hash,
                "timestamp": doc_ts,
                "tx_explorer_url": explorer,
                "kind": "final_on_chain_registration",
                "blockchain_object_id": object_id,
                "metadata_uri": metadata_uri,
                "owner_wallet": owner_wallet,
                "student_wallet_on_chain": bool(on_chain_owner_wallet),
            },
        )
        PipelineService(self.db).on_registered_on_chain(obj, actor.id, tx_hash)
        if commit:
            self.db.commit()
            self.db.refresh(obj)
        else:
            self.db.flush()
        return tx_hash

    def get_object(self, object_id: str):
        client = self._client()
        return client.get_object(object_id)

    def get_actions(self, object_id: str):
        client = self._client()
        return client.get_actions(object_id)

