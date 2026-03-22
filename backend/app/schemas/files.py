from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


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


class DigitalObjectRead(DigitalObjectCreateResponse):
    owner_id: UUID
    owner_wallet_address: str | None = None
    owner_email: str | None = None
    title: str | None = None
    document_type: str | None = None
    storage_key: str
    blockchain_registered_at: datetime | None = None
    # Заполняется только для GET /files/global — последняя передача в блокчейне
    last_transfer_from_wallet: str | None = None
    last_transfer_to_wallet: str | None = None


class Metrics(BaseModel):
    total: int
    on_chain: int
    verified: int
    invalid: int
