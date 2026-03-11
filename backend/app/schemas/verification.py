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
    sha256_hash: str | None = None  # computed or provided hash used for verification
    sha256_stored: str | None = None  # hash stored in registry (when found)

