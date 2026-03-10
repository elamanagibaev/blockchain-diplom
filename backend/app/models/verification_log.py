import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class VerificationLog(Base):
    __tablename__ = "verification_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    digital_object_id = Column(UUID(as_uuid=True), ForeignKey("digital_objects.id"), nullable=True)
    requested_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    requested_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    sha256_hash = Column(String(64), nullable=False, index=True)
    is_verified = Column(Boolean, default=False, nullable=False)
    blockchain_tx_hash = Column(String(100), nullable=True)
    notes = Column(String(1000), nullable=True)

    digital_object = relationship("DigitalObject")
    requested_by = relationship("User")

