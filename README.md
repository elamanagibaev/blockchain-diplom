## Разработка защищенной платформы на основе блокчейна для хранения и верификации данных (MVP)

Полноценный дипломный проект (full-stack) для регистрации цифровых объектов (файлов) **с хранением файла off-chain** и фиксацией **контрольных записей on-chain**.

### Основная идея

- **Файл (контент)** хранится во внешнем хранилище (**локально** или **MinIO**).
- **Блокчейн** хранит только **контрольные данные**:
  - SHA-256 хэш файла
  - timestamp регистрации
  - owner (wallet address)
  - metadataURI (ссылка на off-chain метаданные)

### Стек

- **Blockchain**: Ethereum-compatible (Hardhat local node)
- **Smart contract**: Solidity
- **Backend**: Python + FastAPI + SQLAlchemy + Alembic
- **DB**: PostgreSQL
- **Storage**: MinIO (Docker) или local storage — файлы off-chain, в блокчейне только hash и metadata
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
  - `GET /api/files/metrics`
  - `GET /api/files/{id}`
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

## Сценарий защиты

Подробный пошаговый сценарий для демонстрации на защите: [docs/SCENARIO_DEFENSE.md](docs/SCENARIO_DEFENSE.md)

---

## Документация

- `docs/architecture.md` — компоненты системы и взаимодействие
- `docs/blockchain_design.md` — дизайн smart contract
- `docs/security.md` — вопросы безопасности
- `docs/api.md` — API эндпоинты
- `docs/DEPLOYMENT.md` — развертывание в production

---

## Администратор и начальные данные

Для удобства есть вспомогательный скрипт, создающий пользователя с ролью `admin`.
Запустите его из каталога `backend` (или внутри контейнера) при инициализации базы данных:

```bash
python -m app.scripts.create_admin
```

По умолчанию будет создан аккаунт `admin@example.com` с паролем `admin`.

### Custodial Wallet (новая фича)

При регистрации каждому пользователю автоматически назначается EVM wallet:
- Адрес сохраняется в БД
- Приватный ключ хранится в зашифрованном виде (демо)
- Документы привязываются к wallet при регистрации в блокчейне

Для существующих пользователей без wallet:
```bash
docker compose run --rm backend python -m app.scripts.backfill_wallets
```

### Демо-данные для защиты

**При запуске через Docker** (рекомендуется):

```bash
make seed
# или
docker compose run --rm backend python -m app.scripts.seed_demo
```

**При локальном запуске** (из каталога `backend`):

```bash
cd backend
python -m app.scripts.seed_demo
```

Создаются пользователи и демо-патентные документы:
- `admin@example.com` / `admin`
- `patentee@ip.ru` / `patentee123`
- `inventor@example.com` / `inventor123`

Вы также можете регистрировать пользователей через веб-интерфейс или `POST /api/auth/register`.

Для демонстрации загрузите файлы через интерфейс — они появятся в разделе «Мои патенты»; подайте заявку на
регистрацию в блокчейне и одобрите её в панели администратора.

## Security & Production

Проект включает:

- **Rate limiting** (5 req/min на регистрацию, 10 req/min на вход)
- **Input validation** (пароль должен содержать цифры, заглавные буквы)
- **Input sanitization** (для хэшей, email и текстовых полей)
- **CORS hardening** (ограничение источников)
- **Error handling** (информативные, но безопасные сообщения об ошибках)

Для production-развертывания см. [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

