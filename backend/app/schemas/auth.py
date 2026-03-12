from datetime import datetime

from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class WalletChallengeRequest(BaseModel):
    wallet_address: str


class WalletChallengeResponse(BaseModel):
    message_to_sign: str
    nonce: str
    expires_at: str


class WalletVerifyRequest(BaseModel):
    wallet_address: str
    signature: str


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

