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

