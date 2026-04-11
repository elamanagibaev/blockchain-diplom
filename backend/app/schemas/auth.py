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
    wallet_status: str  # active | none
    document_count: int = 0
    on_chain_count: int = 0
    created_at: datetime


class WalletProfileLookup(BaseModel):
    """Публичные данные пользователя по адресу кошелька (для ссылок из реестра)."""

    id: str
    email: str
    wallet_address: str | None

