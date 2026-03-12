from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FileVerificationResult(BaseModel):
    is_verified: bool
    digital_object_id: UUID | None
    registered_at: datetime | None
    owner_id: UUID | None
    owner_wallet_address: str | None = None
    file_name: str | None
    description: str | None
    transaction_hash: str | None
    blockchain_registered_at: datetime | None = None
    blockchain_object_id: str | None = None
    status: str | None = None
    integrity_status: str
    sha256_hash: str | None = None
    sha256_stored: str | None = None

