import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
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
    document_type = Column(String(50), nullable=True)  # patent, medical, etc.
    visibility = Column(String(20), nullable=False, default="public")

    owner_wallet_address = Column(String(100), nullable=True)  # denormalized for global view

    blockchain_object_id = Column(String(100), nullable=True)
    blockchain_tx_hash = Column(String(100), nullable=True)
    blockchain_registered_at = Column(DateTime(timezone=True), nullable=True)

    status = Column(String(50), nullable=False, default="REGISTERED")
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    owner = relationship("User", backref="digital_objects")
    actions = relationship("ActionHistory", back_populates="digital_object", cascade="all, delete-orphan")

