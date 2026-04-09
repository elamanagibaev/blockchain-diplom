"""
Автоматизация после согласования деканата: on-chain регистрация и закрепление за кошельком студента.
Возврата на кафедру нет. При сбое блокчейна документ остаётся в DEAN_APPROVED.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.constants.document_events import DocumentEventAction
from app.constants.lifecycle import LifecycleStatus, status_allows_on_chain_registration
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.services.blockchain_service import BlockchainService
from app.services.document_event_service import DocumentEventService
from app.services.pipeline_service import PipelineService
from app.utils.block_explorer import make_tx_explorer_url

logger = logging.getLogger(__name__)


class DiplomaAutomationService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def finalize_after_dean_if_ready(self, document: DigitalObject, initiated_by: User) -> bool:
        """
        Этап 4: REGISTER (on-chain), коммит → этап 5: owner_assigned → ASSIGNED_TO_OWNER.
        Caller не обязан делать commit после True (внутри два commit для наблюдаемого REGISTERED).
        """
        if document.blockchain_tx_hash:
            return False
        if not status_allows_on_chain_registration(document.status):
            return False
        sw = (getattr(document, "student_wallet_address", None) or "").strip()
        if not sw:
            logger.warning("diploma automation skipped: no student_wallet_address on %s", document.id)
            return False

        owner = document.owner
        if not owner:
            logger.error("diploma automation: document %s has no owner", document.id)
            return False

        from app.services.file_service import FileService

        bc = BlockchainService(self.db)
        fs = FileService(self.db)

        tx_hash = bc.register_on_chain(
            document,
            owner,
            initiated_by=initiated_by,
            on_chain_owner_wallet=sw,
            commit=False,
            automatic=True,
            workflow="single_stage_dean",
        )
        try:
            fs.migrate_file_to_minio(document)
        except FileNotFoundError:
            logger.warning("migrate_file_to_minio: file missing for %s", document.id)

        # Первый commit: статус REGISTERED, пользователь видит этап 4 в UI.
        self.db.commit()
        self.db.refresh(document)

        PipelineService(self.db).on_assign_student(document, sw, initiated_by.id)
        document.status = LifecycleStatus.ASSIGNED_TO_OWNER.value
        self.db.add(document)

        doc_ts = datetime.now(timezone.utc).isoformat()
        DocumentEventService(self.db).record(
            document_id=document.id,
            user_id=initiated_by.id,
            action=DocumentEventAction.APPROVAL.value,
            metadata={
                "step": "owner_assigned",
                "automatic": True,
                "workflow": "single_stage_dean",
                "tx_hash": tx_hash,
                "timestamp": doc_ts,
                "tx_explorer_url": make_tx_explorer_url(tx_hash),
                "student_wallet": sw,
            },
        )
        self.db.commit()
        self.db.refresh(document)
        return True

    def complete_owner_assign_if_pending(self, document: DigitalObject, initiated_by: User) -> bool:
        """
        Повтор этапа 5, если после успешной регистрации (REGISTERED + tx) привязка не завершилась.
        """
        if document.status != LifecycleStatus.REGISTERED.value:
            return False
        if not document.blockchain_tx_hash:
            return False
        sw = (getattr(document, "student_wallet_address", None) or "").strip()
        if not sw:
            return False

        owner = document.owner
        if not owner:
            logger.error("complete_owner_assign_if_pending: document %s has no owner", document.id)
            return False

        PipelineService(self.db).on_assign_student(document, sw, initiated_by.id)
        document.status = LifecycleStatus.ASSIGNED_TO_OWNER.value
        self.db.add(document)

        tx_hash = document.blockchain_tx_hash
        doc_ts = datetime.now(timezone.utc).isoformat()
        DocumentEventService(self.db).record(
            document_id=document.id,
            user_id=initiated_by.id,
            action=DocumentEventAction.APPROVAL.value,
            metadata={
                "step": "owner_assigned",
                "automatic": True,
                "workflow": "single_stage_dean",
                "tx_hash": tx_hash,
                "timestamp": doc_ts,
                "tx_explorer_url": make_tx_explorer_url(tx_hash),
                "student_wallet": sw,
            },
        )
        self.db.commit()
        self.db.refresh(document)
        return True
