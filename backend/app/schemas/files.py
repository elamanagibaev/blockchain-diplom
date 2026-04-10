from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class DigitalObjectCreateResponse(BaseModel):
    id: UUID
    file_name: str
    mime_type: str
    size_bytes: int
    description: str | None = None
    sha256_hash: str
    status: str
    created_at: datetime
    blockchain_object_id: str | None = None
    blockchain_tx_hash: str | None = None
    student_wallet_address: str | None = None
    tx_explorer_url: str | None = None


class DigitalObjectRead(DigitalObjectCreateResponse):
    owner_id: UUID
    owner_wallet_address: str | None = None
    owner_email: str | None = None
    uploaded_by_id: UUID | None = None
    uploaded_by_email: str | None = None
    uploaded_by_wallet_address: str | None = None
    title: str | None = None
    document_type: str | None = None
    storage_key: str
    blockchain_registered_at: datetime | None = None
    # Заполняется только для GET /files/global — последняя передача в блокчейне
    last_transfer_from_wallet: str | None = None
    last_transfer_to_wallet: str | None = None
    # 5-этапный pipeline (диплом / документооборот)
    processing_stage: int | None = None
    stage_history: list[dict[str, Any]] = Field(default_factory=list)
    department_approved_at: datetime | None = None
    deanery_approved_at: datetime | None = None
    ai_check_status: str = "skipped"
    student_wallet_address: str | None = None


class Metrics(BaseModel):
    total: int
    on_chain: int
    verified: int
    invalid: int


class DocumentEventRead(BaseModel):
    id: UUID
    action: str
    timestamp: datetime
    user_id: UUID | None = None
    metadata: dict | None = None


class DocumentEventJournalRead(BaseModel):
    """Глобальный журнал document_events для админ-обозревателя /explorer."""

    id: UUID
    document_id: UUID | None
    action: str
    timestamp: datetime
    user_id: UUID | None = None
    user_email: str | None = None
    metadata: dict | None = None
    document_file_name: str | None = None
