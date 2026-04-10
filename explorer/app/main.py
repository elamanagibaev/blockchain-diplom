from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.responses import HTMLResponse, JSONResponse

RPC_URL = os.getenv("EXPLORER_RPC_URL", "http://blockchain:8545").strip()
CHAIN_ID = os.getenv("EXPLORER_CHAIN_ID", "31337").strip()
CHAIN_NAME = os.getenv("EXPLORER_CHAIN_NAME", "Hardhat Local").strip()

app = FastAPI(title="Local Explorer", version="1.0.0")


async def _rpc(method: str, params: list[Any]) -> Any:
    payload = {"jsonrpc": "2.0", "id": 1, "method": method, "params": params}
    async with httpx.AsyncClient(timeout=10) as client:
        response = await client.post(RPC_URL, json=payload)
    response.raise_for_status()
    body = response.json()
    if body.get("error"):
        return None
    return body.get("result")


def _fmt_ts(hex_ts: str | None) -> str | None:
    if not hex_ts:
        return None
    try:
        ts = int(hex_ts, 16)
        return datetime.fromtimestamp(ts, tz=timezone.utc).isoformat()
    except Exception:
        return None


def _tx_view_url(tx_hash: str) -> str:
    return f"/tx/{tx_hash}"


@app.get("/", response_class=HTMLResponse)
async def index() -> str:
    return f"""
    <html>
      <head><title>Local Explorer</title></head>
      <body style="font-family: sans-serif; max-width: 960px; margin: 40px auto;">
        <h1>Local Explorer</h1>
        <p>Chain: <b>{CHAIN_NAME}</b> (id {CHAIN_ID})</p>
        <p>RPC: <code>{RPC_URL}</code></p>
        <p>Откройте транзакцию по шаблону: <code>/tx/0x...</code></p>
      </body>
    </html>
    """


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/tx/{tx_hash}")
async def tx_json(tx_hash: str) -> JSONResponse:
    tx = await _rpc("eth_getTransactionByHash", [tx_hash])
    receipt = await _rpc("eth_getTransactionReceipt", [tx_hash])
    block = None
    if tx and tx.get("blockHash"):
        block = await _rpc("eth_getBlockByHash", [tx["blockHash"], False])
    if not tx:
        return JSONResponse(
            status_code=404,
            content={
                "tx_hash": tx_hash,
                "found": False,
                "message": "Transaction not found on local chain",
                "explorer_url": _tx_view_url(tx_hash),
            },
        )
    return JSONResponse(
        {
            "tx_hash": tx_hash,
            "found": True,
            "explorer_url": _tx_view_url(tx_hash),
            "chain_id": CHAIN_ID,
            "chain_name": CHAIN_NAME,
            "transaction": tx,
            "receipt": receipt,
            "block_timestamp": _fmt_ts(block.get("timestamp") if block else None),
        }
    )


@app.get("/tx/{tx_hash}", response_class=HTMLResponse)
async def tx_page(tx_hash: str) -> HTMLResponse:
    tx = await _rpc("eth_getTransactionByHash", [tx_hash])
    receipt = await _rpc("eth_getTransactionReceipt", [tx_hash])
    block = None
    if tx and tx.get("blockHash"):
        block = await _rpc("eth_getBlockByHash", [tx["blockHash"], False])

    if not tx:
        return HTMLResponse(
            status_code=404,
            content=f"""
            <html><body style="font-family: sans-serif; max-width: 960px; margin: 40px auto;">
              <h1>Transaction not found</h1>
              <p><code>{tx_hash}</code></p>
              <p>Проверьте, что транзакция отправлена в локальную сеть и подтверждена.</p>
            </body></html>
            """,
        )

    status = "pending"
    if receipt and receipt.get("status") == "0x1":
        status = "success"
    elif receipt and receipt.get("status") == "0x0":
        status = "failed"

    block_number = tx.get("blockNumber") or "-"
    gas_used = receipt.get("gasUsed") if receipt else "-"
    to_addr = tx.get("to") or "contract creation"
    timestamp = _fmt_ts(block.get("timestamp") if block else None) or "-"
    data_link = f"/api/tx/{tx_hash}"

    return HTMLResponse(
        content=f"""
        <html>
          <head><title>TX {tx_hash}</title></head>
          <body style="font-family: sans-serif; max-width: 960px; margin: 40px auto; line-height: 1.5;">
            <h1>Local Transaction</h1>
            <p>Chain: <b>{CHAIN_NAME}</b> (id {CHAIN_ID})</p>
            <p><b>Hash:</b> <code>{tx_hash}</code></p>
            <p><b>Status:</b> {status}</p>
            <p><b>From:</b> <code>{tx.get("from", "-")}</code></p>
            <p><b>To:</b> <code>{to_addr}</code></p>
            <p><b>Block:</b> <code>{block_number}</code></p>
            <p><b>Timestamp (UTC):</b> {timestamp}</p>
            <p><b>Gas used:</b> <code>{gas_used}</code></p>
            <p><a href="{data_link}">JSON details</a></p>
          </body>
        </html>
        """
    )
