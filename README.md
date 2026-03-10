## Разработка защищенной платформы на основе блокчейна для хранения и верификации данных (MVP)

Полноценный дипломный проект (full-stack) для регистрации цифровых объектов (файлов) **с хранением файла off-chain** и фиксацией **контрольных записей on-chain**.

### Основная идея

- **Файл (контент)** хранится во внешнем хранилище (**локально** или **MinIO**).
- **Блокчейн** хранит только **контрольные данные**:
  - SHA-256 хэш файла
  - timestamp регистрации
  - owner (wallet address)
  - metadataURI (ссылка на off-chain метаданные)
  - история действий

### Стек

- **Blockchain**: Ethereum-compatible (Hardhat local node)
- **Smart contract**: Solidity
- **Backend**: Python + FastAPI + SQLAlchemy + Alembic
- **DB**: PostgreSQL
- **Storage**: local storage abstraction (MinIO поднимается для демонстрации)
- **Blockchain integration**: web3.py
- **Frontend**: React + Vite + Axios + React Router
- **Containers**: Docker + docker-compose (рекомендуется для запуска)

---

## Быстрый запуск (рекомендуется)

### 1) Установить Docker Desktop

На текущей Windows-машине команда `docker` не найдена, поэтому **без Docker** проект поднять “одной командой” нельзя.
Для защиты диплома это обычно и ожидается: ставим Docker Desktop и запускаем.

### 2) Запуск

В корне проекта:

```bash
docker compose up --build
```

Сервисы:

- **Frontend**: `http://localhost:5173`
- **Backend (Swagger)**: `http://localhost:8000/api/docs`
- **MinIO Console**: `http://localhost:9001`
- **Hardhat RPC**: `http://localhost:8545`

Контракт **деплоится автоматически** при старте `blockchain` и пишет:

- `/shared/contract_address.txt`
- `/shared/FileRegistry.abi.json`

Backend читает эти файлы автоматически (если `CONTRACT_ADDRESS` не задан).

---

## Локальный запуск без Docker (только если установлены Node.js + PostgreSQL)

### Важно про Python

У вас установлен **Python 3.14**, а для него многие зависимости (например `pydantic-core`) могут требовать сборку через Rust.
Для простого запуска **рекомендуется Python 3.11/3.12**.

### Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\pip install -r requirements.txt

copy .env.example .env
# поправьте POSTGRES_* и при необходимости blockchain переменные

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### Frontend

Требуется Node.js 20+:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

---

## Основные API эндпоинты

- **Auth**
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
- **Files**
  - `POST /api/files/upload`
  - `GET /api/files`
  - `GET /api/files/{id}`
  - `GET /api/files/{id}/history`
- **Verification**
  - `POST /api/verify/file`
  - `GET /api/verify/hash/{hash}`
- **Blockchain**
  - `POST /api/blockchain/register/{id}`
  - `GET /api/blockchain/object/{object_id}`
  - `GET /api/blockchain/object/{object_id}/history`
  - `GET /api/blockchain/tx/{tx_hash}`
- **Health**
  - `GET /api/health`

Подробности: `docs/api.md`

---

## Документация

- `docs/architecture.md`
- `docs/blockchain_design.md`
- `docs/security.md`
- `docs/api.md`

