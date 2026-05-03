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
      <head><title>Обозреватель сети</title></head>
      <body style="font-family: Inter, Arial, sans-serif; background:#f6f8fb; margin:0; color:#0f172a;">
        <main style="max-width:960px; margin:32px auto; padding:0 16px;">
          <section style="background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:24px; box-shadow:0 8px 24px rgba(15,23,42,.06);">
            <h1 style="margin:0 0 12px; font-size:28px;">Локальный обозреватель блокчейна</h1>
            <p style="margin:8px 0;"><b>Сеть:</b> {CHAIN_NAME} (ID {CHAIN_ID})</p>
            <p style="margin:8px 0;"><b>RPC:</b> <code>{RPC_URL}</code></p>
            <p style="margin:12px 0 0;">Откройте транзакцию по шаблону: <code>/tx/0x...</code></p>
          </section>
        </main>
      </section></main></body>
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
              <h1>Транзакция не найдена</h1>
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

    status_label = "Ожидает подтверждения"
    status_bg = "#f1f5f9"
    status_color = "#0f172a"
    status_border = "#cbd5e1"
    if status == "success":
        status_label = "Подтверждена"
        status_bg = "#ecfdf5"
        status_color = "#166534"
        status_border = "#86efac"
    elif status in {"failed", "error"}:
        status_label = "Ошибка"
        status_bg = "#fef2f2"
        status_color = "#991b1b"
        status_border = "#fca5a5"

    return HTMLResponse(
        content=f"""
        <html>
          <head>
            <title>Транзакция {tx_hash}</title>
            <meta name="viewport" content="width=device-width, initial-scale=1" />
            <style>
              :root {{
                --bg: #ffffff;
                --text: #111827;
                --muted: #475569;
                --border: #d1d5db;
                --accent: #2563eb;
              }}
              * {{ box-sizing: border-box; }}
              body {{
                margin: 0;
                font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
                background: #f8fafc;
                color: var(--text);
              }}
              .wrap {{ max-width: 980px; margin: 32px auto; padding: 0 16px; }}
              .panel {{ background: var(--bg); border: 1px solid var(--border); border-radius: 14px; padding: 22px; }}
              h1 {{ margin: 0 0 8px; font-size: 30px; }}
              .sub {{ margin: 0 0 18px; color: var(--muted); line-height: 1.5; }}
              .grid {{ display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }}
              .card {{ border: 1px solid var(--border); border-radius: 12px; padding: 14px; background: #fff; }}
              .card h2 {{ margin: 0 0 10px; font-size: 16px; }}
              .row {{ margin-bottom: 10px; }}
              .row:last-child {{ margin-bottom: 0; }}
              .label {{ display: block; font-size: 12px; color: var(--muted); margin-bottom: 4px; text-transform: uppercase; letter-spacing: .04em; }}
              .value {{ font-size: 15px; }}
              .mono {{ font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 8px 10px; overflow-wrap: anywhere; word-break: break-word; font-size: 13px; }}
              .badge {{ display: inline-block; border-radius: 999px; border: 1px solid {status_border}; background: {status_bg}; color: {status_color}; font-size: 13px; padding: 4px 10px; font-weight: 600; }}
              .actions {{ margin-top: 14px; }}
              .btn-secondary {{ display: inline-flex; align-items: center; justify-content: center; padding: 8px 12px; border-radius: 8px; border: 1px solid #93c5fd; color: var(--accent); text-decoration: none; font-weight: 600; background: #eff6ff; }}
              .btn-secondary:hover {{ background: #dbeafe; }}
            </style>
          </head>
          <body>
            <main class="wrap">
              <section class="panel">
                <h1>Детали блокчейн-транзакции</h1>
                <p class="sub">На этой странице отображаются сведения о транзакции, с помощью которой данные документа были зафиксированы в локальной блокчейн-сети Hardhat.</p>

                <div class="grid">
                  <article class="card">
                    <h2>Основная информация</h2>
                    <div class="row"><span class="label">Сеть</span><div class="value">{CHAIN_NAME} (ID {CHAIN_ID})</div></div>
                    <div class="row"><span class="label">Статус</span><span class="badge">{status_label}</span></div>
                    <div class="row"><span class="label">Блок</span><div class="mono">{block_number}</div></div>
                    <div class="row"><span class="label">Время (UTC)</span><div class="value">{timestamp}</div></div>
                  </article>

                  <article class="card">
                    <h2>Участники транзакции</h2>
                    <div class="row"><span class="label">Отправитель</span><div class="mono">{tx.get("from", "-")}</div></div>
                    <div class="row"><span class="label">Смарт-контракт / получатель</span><div class="mono">{to_addr}</div></div>
                  </article>

                  <article class="card">
                    <h2>Технические данные</h2>
                    <div class="row"><span class="label">Хэш транзакции</span><div class="mono">{tx_hash}</div></div>
                    <div class="row"><span class="label">Использовано газа</span><div class="mono">{gas_used}</div></div>
                  </article>
                </div>

                <div class="actions">
                  <a class="btn-secondary" href="{data_link}">Показать JSON-данные</a>
                </div>
              </section>
            </main>
          </body>
        </html>
        """
    )
