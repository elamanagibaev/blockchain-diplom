from typing import Any
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str | None = Field(None, max_length=128)
    wallet_address: str | None = Field(None, max_length=255)
    role: str = Field(default="student", max_length=50)
    registration_code: str | None = Field(None, pattern=r"^\d{5}$")
    enrollment_year: int | None = None
    major: str | None = Field(None, max_length=255)

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
    email: str
    full_name: str | None = None
    role: str
    wallet_address: str | None = None
    is_active: bool
    university_id: int | None = None
    university_name: str | None = None
    enrollment_year: int | None = None
    major: str | None = None

    class Config:
        from_attributes = True

    @classmethod
    def from_orm(cls, user: Any) -> "UserRead":
        uni = getattr(user, "university", None)
        return cls(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            role=user.role,
            wallet_address=user.wallet_address,
            is_active=user.is_active,
            university_id=getattr(user, "university_id", None),
            university_name=uni.name if uni is not None else None,
            enrollment_year=getattr(user, "enrollment_year", None),
            major=getattr(user, "major", None),
        )
