import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class ApprovalAction(Base):
    __tablename__ = "approval_actions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("digital_objects.id", ondelete="CASCADE"), nullable=False, index=True)
    stage_definition_id = Column(
        Integer,
        ForeignKey("approval_stage_definitions.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    actor_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    action = Column(String(20), nullable=False, index=True)  # APPROVE | REJECT
    comment = Column(String(1000), nullable=True)
    # Колонка в БД — metadata (зарезервировано как имя атрибута в Declarative)
    action_metadata = Column("metadata", JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    document = relationship("DigitalObject", backref="approval_actions")
    stage = relationship("ApprovalStageDefinition")
    actor = relationship("User")
