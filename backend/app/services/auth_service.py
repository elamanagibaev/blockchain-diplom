from datetime import timedelta
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.user import User
from app.schemas.user import UserCreate
from app.utils.wallet import generate_evm_wallet, encrypt_private_key
settings = get_settings()


def ensure_user_wallet(user: User, db: Session) -> User:
    """If user has no wallet, generate one. Used for backfill / legacy users."""
    if user.wallet_address:
        return user
    address, pk_hex = generate_evm_wallet()
    encrypted = encrypt_private_key(pk_hex, settings.SECRET_KEY)
    user.wallet_address = address
    user.wallet_encrypted_private_key = encrypted
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


class AuthService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def register_user(self, user_in: UserCreate) -> User:
        existing = self.db.query(User).filter(User.email == user_in.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User with this email already exists",
            )

        # Auto-generate custodial wallet for new user
        address, pk_hex = generate_evm_wallet()
        encrypted = encrypt_private_key(pk_hex, settings.SECRET_KEY)

        user = User(
            email=user_in.email,
            full_name=user_in.full_name,
            wallet_address=address,
            wallet_encrypted_private_key=encrypted,
            hashed_password=get_password_hash(user_in.password),
            role="user",
            is_active=True,
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user

    def authenticate(self, email: str, password: str) -> Optional[User]:
        user = self.db.query(User).filter(User.email == email).first()
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        if not user.is_active:
            return None
        return user

    def create_login_token(self, user: User) -> tuple[str, int]:
        expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        token = create_access_token(str(user.id), expires_delta=expires)
        return token, int(expires.total_seconds())

