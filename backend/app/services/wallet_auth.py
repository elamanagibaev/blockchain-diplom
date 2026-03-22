"""
Challenge-response wallet authentication.
Stores challenges in-memory (demo); use Redis in production.
"""
import secrets
import time
from typing import Optional

from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from datetime import timedelta

from app.core.config import get_settings
from app.core.security import create_access_token
from app.models.user import User
from app.utils.wallet import is_valid_address

settings = get_settings()

# In-memory challenge store: wallet_address -> { message, nonce, expires }
_challenges: dict[str, dict] = {}
_CHALLENGE_TTL_SEC = 300  # 5 min
_CHALLENGE_CLEANUP_INTERVAL = 60
_last_cleanup = 0.0


def _cleanup_expired() -> None:
    global _last_cleanup
    now = time.time()
    if now - _last_cleanup < _CHALLENGE_CLEANUP_INTERVAL:
        return
    _last_cleanup = now
    expired = [k for k, v in _challenges.items() if v["expires"] < now]
    for k in expired:
        del _challenges[k]


def create_challenge(wallet_address: str) -> tuple[str, str, str]:
    """Create challenge for wallet. Returns (message_to_sign, nonce, expires_at_iso)."""
    if not is_valid_address(wallet_address):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid wallet address",
        )
    addr = wallet_address.strip().lower()
    _cleanup_expired()
    nonce = secrets.token_hex(16)
    expires_ts = time.time() + _CHALLENGE_TTL_SEC
    message = f"Sign this message to sign in to BlockProof.\nNonce: {nonce}\nTimestamp: {int(time.time())}"
    _challenges[addr] = {
        "message": message,
        "nonce": nonce,
        "expires": expires_ts,
    }
    from datetime import datetime, timezone
    expires_at = datetime.fromtimestamp(expires_ts, tz=timezone.utc).isoformat()
    return message, nonce, expires_at


def verify_signature_and_login(
    db: Session,
    wallet_address: str,
    signature: str,
) -> tuple[str, int]:
    """
    Verify wallet signature and return (access_token, expires_in).
    Raises HTTPException if invalid.
    """
    if not is_valid_address(wallet_address):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid wallet address",
        )
    if not signature or len(signature) < 130:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature",
        )
    addr = wallet_address.strip().lower()
    _cleanup_expired()
    challenge = _challenges.get(addr)
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Challenge expired or not found. Request a new one.",
        )
    if challenge["expires"] < time.time():
        del _challenges[addr]
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Challenge expired. Request a new one.",
        )
    try:
        signable = encode_defunct(text=challenge["message"])
        recovered = Account.recover_message(signable, signature=signature)
        recovered_lower = recovered.lower()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid signature: {str(e)}",
        ) from e
    # Remove used challenge
    del _challenges[addr]
    if recovered_lower != addr:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Signature does not match wallet address",
        )
    # Find user by wallet
    user = db.query(User).filter(User.wallet_address.ilike(wallet_address)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No account linked to this wallet. Register first with email.",
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )
    from app.services.auth_service import AuthService
    token, expires_in = AuthService(db).create_login_token(user)
    return token, expires_in
