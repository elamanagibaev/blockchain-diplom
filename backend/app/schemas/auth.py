from datetime import datetime

from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class MeResponse(BaseModel):
    id: str
    email: str
    full_name: str | None
    role: str
    wallet_address: str | None
    created_at: datetime

