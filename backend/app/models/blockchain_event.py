"""Blockchain Journal - global log of REGISTER and TRANSFER events."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class BlockchainEvent(Base):
    """Record of important blockchain events: document registration and transfers."""

    __tablename__ = "blockchain_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    action_type = Column(String(30), nullable=False, index=True)  # REGISTER | TRANSFER
    document_id = Column(UUID(as_uuid=True), ForeignKey("digital_objects.id"), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    tx_hash = Column(String(100), nullable=False, index=True)
    from_wallet = Column(String(100), nullable=True)
    to_wallet = Column(String(100), nullable=True)
    initiator_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)

    digital_object = relationship("DigitalObject", backref="blockchain_events")
    initiator = relationship("User")
