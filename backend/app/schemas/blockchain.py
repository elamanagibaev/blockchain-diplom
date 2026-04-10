from datetime import datetime

from pydantic import BaseModel


class BlockchainObject(BaseModel):
    object_id: str
    file_hash: str
    owner: str
    registered_at: datetime
    metadata_uri: str | None = None
    current_status: str
    exists: bool


class BlockchainAction(BaseModel):
    action_type: str
    timestamp: datetime
    actor: str
    details: str | None = None


class BlockchainEventRead(BaseModel):
    id: str
    action_type: str
    document_id: str
    document_file_name: str | None = None
    timestamp: datetime
    tx_hash: str
    from_wallet: str | None
    to_wallet: str | None
    initiator_user_id: str | None
    initiator_email: str | None = None
    tx_explorer_url: str | None = None

