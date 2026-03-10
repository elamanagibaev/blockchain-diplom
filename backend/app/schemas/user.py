from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = None
    wallet_address: str | None = None


class UserRead(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str | None = None
    role: str
    wallet_address: str | None = None
    is_active: bool

    class Config:
        from_attributes = True

