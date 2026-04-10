from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class FileVerificationResult(BaseModel):
    """Результат проверки по файлу или по хэшу (обратная совместимость + verification_status)."""

    verification_status: str = Field(
        ...,
        description="VALID | INVALID | NOT_FOUND | INVALID_HASH",
    )
    is_verified: bool
    digital_object_id: UUID | None
    registered_at: datetime | None = None
    """Дата загрузки документа в систему (created_at)."""
    registration_timestamp: datetime | None = None
    """Дата официальной регистрации в блокчейне (blockchain_registered_at), только при VALID."""
    owner_id: UUID | None = None
    owner_email: str | None = None
    owner_wallet_address: str | None = None
    file_name: str | None = None
    description: str | None = None
    transaction_hash: str | None = None
    tx_explorer_url: str | None = None
    blockchain_registered_at: datetime | None = None
    blockchain_object_id: str | None = None
    status: str | None = None
    integrity_status: str
    sha256_hash: str | None = None
    sha256_stored: str | None = None
    # Расширение для UI: этапы pipeline и журнал on-chain в БД
    processing_stage: Optional[int] = None
    stage_history: list[dict[str, Any]] = Field(default_factory=list)
    chain_events: list[dict[str, Any]] = Field(default_factory=list)
    department_approved_at: Optional[datetime] = None
    deanery_approved_at: Optional[datetime] = None
    student_wallet_address: Optional[str] = None


class PublicVerifyDocumentResponse(BaseModel):
    """Публичная карточка документа по ссылке verify (без загрузки файла)."""

    document_id: UUID
    status: str
    owner_email: str | None = None
    owner_wallet_address: str | None = None
    registration_timestamp: datetime | None = None
    hash_short: str
    verify_url: str
    is_authentic: bool = Field(description="True если REGISTERED_ON_CHAIN и есть tx")
