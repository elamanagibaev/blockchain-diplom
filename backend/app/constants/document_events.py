"""Типы записей в журнале DocumentEvent (поле action)."""

from enum import Enum


class DocumentEventAction(str, Enum):
    UPLOAD = "UPLOAD"
    FREEZE = "FREEZE"
    APPROVAL = "APPROVAL"
    # Внутреннее согласование завершено; отдельно — финальная REGISTER on-chain
    APPROVAL_COMPLETED = "APPROVAL_COMPLETED"
    REGISTER = "REGISTER"
    VERIFY = "VERIFY"  # legacy
    VERIFY_REQUEST = "VERIFY_REQUEST"
    VERIFY_SUCCESS = "VERIFY_SUCCESS"
    VERIFY_FAILED = "VERIFY_FAILED"
