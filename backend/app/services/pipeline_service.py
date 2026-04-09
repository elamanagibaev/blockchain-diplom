"""5-stage document pipeline: history JSON, timestamps, processing_stage cache."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.constants.lifecycle import LifecycleStatus
from app.models.digital_object import DigitalObject
from app.models.user import User


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _append_history(obj: DigitalObject, entry: dict[str, Any]) -> None:
    raw = obj.stage_history
    hist: list = list(raw) if isinstance(raw, list) else []
    entry.setdefault("timestamp", _now().isoformat())
    hist.append(entry)
    obj.stage_history = hist
    flag_modified(obj, "stage_history")


def _set_stage(obj: DigitalObject, n: int) -> None:
    obj.processing_stage = max(1, min(5, n))


class PipelineService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def on_upload_fixed(self, obj: DigitalObject, user_id: UUID) -> None:
        _append_history(
            obj,
            {
                "stage": 1,
                "action": "primary_fixation",
                "actor": str(user_id),
                "label": "Фиксация и заморозка хэша",
            },
        )
        _set_stage(obj, 1)
        self.db.add(obj)

    def on_submit_for_review(self, obj: DigitalObject, user_id: UUID) -> None:
        _append_history(
            obj,
            {
                "stage": 3,
                "action": "submit_expert_review",
                "actor": str(user_id),
                "label": "Подача на экспертное согласование",
            },
        )
        _set_stage(obj, 3)
        self.db.add(obj)

    def on_department_approved(self, obj: DigitalObject, actor: User) -> None:
        obj.department_approved_at = _now()
        _append_history(
            obj,
            {
                "stage": 3,
                "action": "department_approve",
                "actor": str(actor.id),
                "label": "Согласование кафедры",
            },
        )
        _set_stage(obj, 3)
        self.db.add(obj)

    def on_deanery_approved(self, obj: DigitalObject, actor: User) -> None:
        obj.deanery_approved_at = _now()
        _append_history(
            obj,
            {
                "stage": 3,
                "action": "deanery_approve",
                "actor": str(actor.id),
                "label": "Согласование деканата",
            },
        )
        _set_stage(obj, 3)
        self.db.add(obj)

    def on_registered_on_chain(self, obj: DigitalObject, actor_id: UUID | None, tx_hash: str) -> None:
        _append_history(
            obj,
            {
                "stage": 4,
                "action": "registry_registration",
                "actor": str(actor_id) if actor_id else None,
                "label": "Регистрация в смарт-контракте",
                "tx_hash": tx_hash,
            },
        )
        _set_stage(obj, 4)
        self.db.add(obj)

    def on_assign_student(self, obj: DigitalObject, wallet: str, actor_id: UUID) -> None:
        obj.student_wallet_address = wallet.strip()
        _append_history(
            obj,
            {
                "stage": 5,
                "action": "assign_student",
                "actor": str(actor_id),
                "label": "Привязка к кошельку выпускника",
                "wallet": wallet.strip(),
            },
        )
        _set_stage(obj, 5)
        self.db.add(obj)

    @staticmethod
    def compute_processing_stage(obj: DigitalObject) -> int:
        """Derive 1–5 from status and timestamps (cache may be None on old rows)."""
        s = obj.status
        if s in (LifecycleStatus.UPLOADED.value, LifecycleStatus.FROZEN.value, LifecycleStatus.REJECTED.value):
            return 1
        if s == LifecycleStatus.UNDER_REVIEW.value:
            return 3
        if s in (LifecycleStatus.APPROVED.value, LifecycleStatus.DEAN_APPROVED.value):
            return 3
        if s == LifecycleStatus.REGISTERED.value:
            return 4
        if s == LifecycleStatus.ASSIGNED_TO_OWNER.value:
            return 5
        if s == LifecycleStatus.REGISTERED_ON_CHAIN.value:
            if obj.student_wallet_address:
                return 5
            return 4
        if s == LifecycleStatus.TRANSFERRED.value:
            return 5
        return obj.processing_stage or 1
