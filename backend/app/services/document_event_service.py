"""Запись событий в журнал document_events."""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

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
        return ev
