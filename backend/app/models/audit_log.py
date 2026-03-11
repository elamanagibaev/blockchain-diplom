"""Системный журнал действий (audit log) для аудита операций."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID

from app.db.session import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action_type = Column(String(80), nullable=False, index=True)
    performed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    actor_wallet_address = Column(String(100), nullable=True)

    target_document_id = Column(UUID(as_uuid=True), ForeignKey("digital_objects.id"), nullable=True, index=True)

    from_wallet = Column(String(100), nullable=True)
    to_wallet = Column(String(100), nullable=True)

    status = Column(String(30), nullable=False, default="success")  # success, failed
    details = Column(String(2000), nullable=True)
