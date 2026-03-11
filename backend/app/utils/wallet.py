"""
Demo-friendly custodial wallet: EVM keypair generation and encrypted storage.
Private key is encrypted with application secret for local/demo use.
"""
import base64
import hashlib
import secrets
from typing import Optional

from eth_account import Account
from web3 import Web3


def generate_evm_wallet() -> tuple[str, str]:
    """Generate new EVM wallet. Returns (address, private_key_hex)."""
    acct = Account.create(extra_entropy=secrets.token_hex(32))
    return acct.address, acct.key.hex()


def _derive_fernet_key(secret: str) -> bytes:
    """Derive a valid Fernet key (32 url-safe base64-encoded bytes) from secret."""
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def encrypt_private_key(private_key_hex: str, secret: str) -> str:
    """Encrypt private key for storage. Demo use only."""
    from cryptography.fernet import Fernet
    key = _derive_fernet_key(secret)
    f = Fernet(key)
    return f.encrypt(private_key_hex.encode()).decode()


def decrypt_private_key(encrypted: str, secret: str) -> str:
    """Decrypt stored private key."""
    from cryptography.fernet import Fernet
    key = _derive_fernet_key(secret)
    f = Fernet(key)
    return f.decrypt(encrypted.encode()).decode()


def is_valid_address(addr: Optional[str]) -> bool:
    """Check if string is valid Ethereum address."""
    if not addr or not isinstance(addr, str):
        return False
    try:
        Web3.to_checksum_address(addr.strip())
        return len(addr) == 42 and addr.startswith("0x")
    except Exception:
        return False
