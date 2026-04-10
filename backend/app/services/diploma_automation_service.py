"""
Автоматизация после согласования деканата: on-chain регистрация и закрепление за кошельком студента.
Возврата на кафедру нет. При сбое блокчейна документ остаётся в DEAN_APPROVED.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy import func
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

    def _assign_owner_from_student_wallet(
        self,
        document: DigitalObject,
        student_wallet: str,
        initiated_by: User,
        tx_hash: str | None,
        automatic: bool,
    ) -> None:
        """Финализирует ownership в БД по student_wallet после этапа 5."""
        previous_owner_id = document.owner_id
        previous_owner_wallet = document.owner_wallet_address or (document.owner.wallet_address if document.owner else None)
        matched_owner = (
            self.db.query(User)
            .filter(func.lower(User.wallet_address) == func.lower(student_wallet))
            .first()
        )
        document.owner_wallet_address = student_wallet
        if matched_owner:
            document.owner_id = matched_owner.id

        owner_equals_uploader = bool(
            matched_owner
            and getattr(document, "uploaded_by_id", None)
            and matched_owner.id == document.uploaded_by_id
        )
        if owner_equals_uploader:
            logger.warning(
                "owner assignment: student wallet equals uploader wallet for document %s",
                document.id,
            )

        doc_ts = datetime.now(timezone.utc).isoformat()
        DocumentEventService(self.db).record(
            document_id=document.id,
            user_id=initiated_by.id,
            action=DocumentEventAction.APPROVAL.value,
            metadata={
                "step": "owner_assigned",
                "automatic": automatic,
                "workflow": "single_stage_dean",
                "tx_hash": tx_hash,
                "timestamp": doc_ts,
                "tx_explorer_url": make_tx_explorer_url(tx_hash),
                "assigned_by": "automatic",
                "source": "student_wallet_from_upload",
                "student_wallet": student_wallet,
                "previous_owner_id": str(previous_owner_id) if previous_owner_id else None,
                "previous_owner_wallet": previous_owner_wallet,
                "new_owner_id": str(document.owner_id) if document.owner_id else None,
                "new_owner_wallet": student_wallet,
                "owner_user_found": bool(matched_owner),
                "owner_pending_registration": matched_owner is None,
                "owner_equals_uploader_wallet": owner_equals_uploader,
            },
        )

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
        self._assign_owner_from_student_wallet(document, sw, initiated_by, tx_hash, automatic=True)
        document.status = LifecycleStatus.ASSIGNED_TO_OWNER.value
        self.db.add(document)
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

        PipelineService(self.db).on_assign_student(document, sw, initiated_by.id)
        self._assign_owner_from_student_wallet(
            document,
            sw,
            initiated_by,
            document.blockchain_tx_hash,
            automatic=True,
        )
        document.status = LifecycleStatus.ASSIGNED_TO_OWNER.value
        self.db.add(document)
        self.db.commit()
        self.db.refresh(document)
        return True
