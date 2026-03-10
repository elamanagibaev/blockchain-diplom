from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class FileVerificationResult(BaseModel):
    is_verified: bool
    digital_object_id: UUID | None
    registered_at: datetime | None
    owner_id: UUID | None
    file_name: str | None
    description: str | None
    transaction_hash: str | None
    integrity_status: str

