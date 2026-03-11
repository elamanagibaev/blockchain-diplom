import re
from html import escape


def sanitize_string(s: str, max_length: int = 1000) -> str:
    """
    Basic sanitization: trim, remove control chars, escape HTML.
    """
    if not isinstance(s, str):
        return str(s)[:max_length]
    
    # Remove control characters
    s = re.sub(r'[\x00-\x1f\x7f-\x9f]', '', s)
    
    # Trim to max length
    s = s[:max_length]
    
    # Escape HTML
    s = escape(s)
    
    return s


def sanitize_email(email: str) -> str:
    """
    Basic email sanitization.
    """
    return sanitize_string(email, max_length=255).lower()


def sanitize_hash(hash_str: str) -> str:
    """
    Only alphanumeric characters allowed for hash.
    """
    return re.sub(r'[^a-fA-F0-9]', '', hash_str).lower()
