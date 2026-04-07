import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship

from app.db.session import Base


class DigitalObject(Base):
    __tablename__ = "digital_objects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)

    file_name = Column(String(255), nullable=False)
    title = Column(String(255), nullable=True)  # display title, defaults to file_name
    mime_type = Column(String(255), nullable=False)
    size_bytes = Column(Integer, nullable=False)

    storage_key = Column(String(500), nullable=False)
    storage_backend = Column(String(20), nullable=False, default="local")  # "local" | "minio"
    sha256_hash = Column(String(64), nullable=False, index=True)
    description = Column(String(1000), nullable=True)
    document_type = Column(String(50), nullable=True)  # patent, image, etc.
    visibility = Column(String(20), nullable=False, default="public")

    owner_wallet_address = Column(String(100), nullable=True)  # denormalized for global view

    blockchain_object_id = Column(String(100), nullable=True)
    blockchain_tx_hash = Column(String(100), nullable=True)
    blockchain_registered_at = Column(DateTime(timezone=True), nullable=True)

    # LifecycleStatus: UPLOADED | FROZEN | UNDER_REVIEW | APPROVED | REGISTERED_ON_CHAIN | REJECTED | TRANSFERRED
    status = Column(String(50), nullable=False, default="FROZEN")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # 5-stage pipeline (UI + audit); processing_stage 1–5, stage_history — JSON array of events
    processing_stage = Column(Integer, nullable=True)
    stage_history = Column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    department_approved_at = Column(DateTime(timezone=True), nullable=True)
    deanery_approved_at = Column(DateTime(timezone=True), nullable=True)
    ai_check_status = Column(String(20), nullable=False, default="skipped", server_default="skipped")
    student_wallet_address = Column(String(100), nullable=True)

    owner = relationship("User", backref="digital_objects")

