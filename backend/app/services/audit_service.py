"""Сервис записи в журнал аудита."""
from uuid import UUID
from typing import Optional

from sqlalchemy.orm import Session

from app.models.audit_log import AuditLog
from app.models.user import User


class AuditService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def log(
        self,
        action_type: str,
        actor_user_id: Optional[UUID] = None,
        actor_wallet: Optional[str] = None,
        target_document_id: Optional[UUID] = None,
        from_wallet: Optional[str] = None,
        to_wallet: Optional[str] = None,
        status: str = "success",
        details: Optional[str] = None,
    ) -> None:
        entry = AuditLog(
            action_type=action_type,
            actor_user_id=actor_user_id,
            actor_wallet_address=actor_wallet,
            target_document_id=target_document_id,
            from_wallet=from_wallet,
            to_wallet=to_wallet,
            status=status,
            details=details,
        )
        self.db.add(entry)
        self.db.flush()

    def log_user_created(self, user: User) -> None:
        self.log("USER_CREATED", actor_user_id=user.id, actor_wallet=user.wallet_address)

    def log_login(self, user: User, success: bool = True) -> None:
        self.log(
            "USER_LOGIN",
            actor_user_id=user.id,
            actor_wallet=user.wallet_address,
            status="success" if success else "failed",
        )

    def log_login_failed(self, email: str) -> None:
        self.log("USER_LOGIN", status="failed", details=f"Failed login attempt: {email}")

    def log_document_upload(self, user: User, doc_id: UUID, doc_hash: str) -> None:
        self.log(
            "DOCUMENT_UPLOAD",
            actor_user_id=user.id,
            actor_wallet=user.wallet_address,
            target_document_id=doc_id,
            details=f"Hash: {doc_hash[:16]}…",
        )

    def log_blockchain_register_attempt(self, user: User, doc_id: UUID, success: bool, details: Optional[str] = None) -> None:
        self.log(
            "BLOCKCHAIN_REGISTER" if success else "BLOCKCHAIN_REGISTER_FAILED",
            actor_user_id=user.id,
            actor_wallet=user.wallet_address,
            target_document_id=doc_id,
            status="success" if success else "failed",
            details=details,
        )

    def log_transfer(
        self,
        actor: User,
        doc_id: UUID,
        from_wallet: str,
        to_wallet: str,
        new_owner_id: UUID,
        success: bool = True,
    ) -> None:
        self.log(
            "DOCUMENT_TRANSFER",
            actor_user_id=actor.id,
            actor_wallet=actor.wallet_address,
            target_document_id=doc_id,
            from_wallet=from_wallet,
            to_wallet=to_wallet,
            status="success" if success else "failed",
            details=str(new_owner_id),
        )
