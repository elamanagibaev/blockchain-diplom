"""Запись событий в журнал document_events."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.document_event import DocumentEvent

logger = logging.getLogger(__name__)


class DocumentEventService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def record(
        self,
        *,
        document_id: UUID | None,
        action: str,
        user_id: UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> DocumentEvent:
        """
        Добавляет событие в сессию (без commit — вызывающий код делает commit).
        document_id может быть None для событий верификации до сопоставления с документом.
        """
        ev = DocumentEvent(
            document_id=document_id,
            user_id=user_id,
            action=action,
            event_metadata=metadata,
        )
        self.db.add(ev)
        logger.info(
            "document_event queued in session: action=%s document_id=%s user_id=%s event_id=%s",
            action,
            document_id,
            user_id,
            getattr(ev, "id", None),
        )
        return ev

    def record_or_update_latest_check(
        self,
        *,
        document_id: UUID,
        action: str,
        user_id: UUID | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> DocumentEvent:
        """
        Хранит одну служебную запись последней проверки документа.
        Это не засоряет журнал десятками одинаковых VERIFY_SUCCESS/VERIFY_FAILED.
        События с method=demo_data_change не трогает: они являются фактом нарушения цепочки доверия.
        """
        existing = (
            self.db.query(DocumentEvent)
            .filter(DocumentEvent.document_id == document_id, DocumentEvent.action == action)
            .order_by(DocumentEvent.timestamp.desc())
            .all()
        )
        for ev in existing:
            meta = ev.event_metadata if isinstance(ev.event_metadata, dict) else {}
            if meta.get("verification_kind") == "last_check":
                ev.user_id = user_id
                ev.timestamp = datetime.now(timezone.utc)
                ev.event_metadata = metadata or {}
                self.db.add(ev)
                return ev
        return self.record(
            document_id=document_id,
            user_id=user_id,
            action=action,
            metadata=metadata or {},
        )
