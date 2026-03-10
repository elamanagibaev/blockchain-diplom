import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class ActionHistory(Base):
    __tablename__ = "action_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    digital_object_id = Column(
        UUID(as_uuid=True), ForeignKey("digital_objects.id"), nullable=False, index=True
    )
    action_type = Column(String(50), nullable=False)
    performed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    performed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    details = Column(String(2000), nullable=True)
    blockchain_tx_hash = Column(String(100), nullable=True)

    digital_object = relationship("DigitalObject", back_populates="actions")
    performed_by = relationship("User")

