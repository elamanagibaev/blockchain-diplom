import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class DocumentEvent(Base):
    """Журнал событий по документу (аудит действий)."""

    __tablename__ = "document_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("digital_objects.id", ondelete="CASCADE"), nullable=True, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(30), nullable=False, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    # Имя колонки в БД — metadata; в Python нельзя — зарезервировано в Declarative API
    event_metadata = Column("metadata", JSONB, nullable=True)

    document = relationship("DigitalObject", backref="document_events")
    user = relationship("User")
