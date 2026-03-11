from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(None, max_length=128)
    wallet_address: str | None = Field(None, max_length=255)

    @field_validator("email")
    @classmethod
    def email_lowercase(cls, v):
        return v.lower()

    @field_validator("password")
    @classmethod
    def password_complexity(cls, v):
        # At least one uppercase, one lowercase, one digit
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserRead(BaseModel):
    id: UUID
    email: EmailStr
    full_name: str | None = None
    role: str
    wallet_address: str | None = None
    is_active: bool

    class Config:
        from_attributes = True

