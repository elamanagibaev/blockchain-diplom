"""Публичные URL обозревателя блоков для ссылок в API (tx)."""

from __future__ import annotations

from app.core.config import get_settings


def make_tx_explorer_url(tx_hash: str | None) -> str | None:
    h = (tx_hash or "").strip()
    if not h:
        return None
    base = (get_settings().BLOCK_EXPLORER_URL or "").strip().rstrip("/")
    if not base:
        return None
    return f"{base}/tx/{h}"
