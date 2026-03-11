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
    storage_key: str


class ActionHistoryItem(BaseModel):
    id: UUID
    action_type: str
    performed_at: datetime
    performed_by_id: UUID | None = None
    details: str | None = None
    blockchain_tx_hash: str | None = None

    class Config:
        from_attributes = True


class DigitalObjectWithHistory(DigitalObjectRead):
    actions: list[ActionHistoryItem]


class Metrics(BaseModel):
    total: int
    on_chain: int
    verified: int
    invalid: int


class RecentActivityItem(BaseModel):
    id: UUID
    action_type: str
    performed_at: datetime
    file_name: str
    object_id: UUID
    details: str | None = None


class RecentActivityResponse(BaseModel):
    actions: list[RecentActivityItem]

