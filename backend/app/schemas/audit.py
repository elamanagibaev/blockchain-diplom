from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class AuditLogRead(BaseModel):
    id: UUID
    action_type: str
    performed_at: datetime
    actor_user_id: UUID | None
    actor_wallet_address: str | None
    target_document_id: UUID | None
    from_wallet: str | None
    to_wallet: str | None
    status: str
    details: str | None

    class Config:
        from_attributes = True
