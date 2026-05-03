from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.api.deps import get_current_user, get_db
from app.models.digital_object import DigitalObject
from app.models.user import User
from app.schemas.auth import MeResponse, Token, WalletProfileLookup
from app.schemas.user import UserCreate, UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead)
def register(user_in: UserCreate, db: Session = Depends(get_db)) -> UserRead:
    user = AuthService(db).register_user(user_in)
    user = db.query(User).options(joinedload(User.university)).filter(User.id == user.id).first()
    return UserRead.from_orm(user)


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)) -> Token:
    user = AuthService(db).authenticate(form_data.username, form_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    token, expires_in = AuthService(db).create_login_token(user)
    return Token(access_token=token, expires_in=expires_in)


@router.get("/wallet/{address}/lookup", response_model=WalletProfileLookup)
def lookup_user_by_wallet(
    address: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WalletProfileLookup:
    """Найти пользователя по адресу кошелька (для перехода из общего реестра)."""
    addr = (address or "").strip()
    if not addr:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Адрес не указан")
    user = db.query(User).filter(User.wallet_address.ilike(addr)).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
    return WalletProfileLookup(
        id=str(user.id),
        email=user.email,
        wallet_address=user.wallet_address,
    )


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
        university_id=current_user.university_id,
        university_name=current_user.university.name if current_user.university else None,
        enrollment_year=current_user.enrollment_year,
        major=current_user.major,
    )

