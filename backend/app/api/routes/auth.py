from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.schemas.auth import (
    MeResponse,
    Token,
    WalletChallengeRequest,
    WalletChallengeResponse,
    WalletVerifyRequest,
)
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import AuthService
from app.services.audit_service import AuditService
from app.services.wallet_auth import create_challenge, verify_signature_and_login

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> User:
    return AuthService(db).register_user(user_in)


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Token:
    user = AuthService(db).authenticate(form_data.username, form_data.password)
    if not user:
        AuditService(db).log_login_failed(form_data.username)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    AuditService(db).log_login(user)
    db.commit()
    token, expires_in = AuthService(db).create_login_token(user)
    return Token(access_token=token, expires_in=expires_in)


@router.get("/me", response_model=MeResponse)
def me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeResponse:
    doc_count = db.query(func.count(DigitalObject.id)).filter(DigitalObject.owner_id == current_user.id).scalar() or 0
    on_chain = (
        db.query(func.count(DigitalObject.id))
        .filter(DigitalObject.owner_id == current_user.id, DigitalObject.blockchain_tx_hash.isnot(None))
        .scalar()
        or 0
    )
    return MeResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role,
        wallet_address=current_user.wallet_address,
        wallet_status="active" if current_user.wallet_address else "none",
        document_count=doc_count,
        on_chain_count=on_chain,
        created_at=current_user.created_at,
    )


@router.post("/wallet/challenge", response_model=WalletChallengeResponse)
def wallet_challenge(body: WalletChallengeRequest):
    """Get challenge message to sign with wallet. No auth required."""
    message, nonce, expires_at = create_challenge(body.wallet_address)
    return WalletChallengeResponse(
        message_to_sign=message,
        nonce=nonce,
        expires_at=expires_at,
    )


@router.post("/wallet/verify", response_model=Token)
def wallet_verify(body: WalletVerifyRequest, db: Session = Depends(get_db)):
    """Verify wallet signature and return access token. No auth required."""
    token, expires_in = verify_signature_and_login(db, body.wallet_address, body.signature)
    return Token(access_token=token, token_type="bearer", expires_in=expires_in)

