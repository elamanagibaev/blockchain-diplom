## Архитектура (MVP)

### Компоненты

- **Frontend (`frontend/`)**: React SPA.
- **Backend (`backend/`)**: FastAPI API + бизнес-логика.
- **Blockchain (`blockchain/`)**: Hardhat node + Solidity контракт `FileRegistry`.
- **DB**: PostgreSQL (off-chain метаданные и аудит).
- **Storage**: Off-chain хранилище файлов (локально; MinIO поднимается для демонстрации).

### Потоки данных

#### Регистрация объекта

1. Пользователь загружает файл в `/api/files/upload` (multipart).
2. Backend:
   - проверяет размер/тип
   - считает SHA-256
   - сохраняет файл off-chain (storage)
   - пишет метаданные в PostgreSQL (`digital_objects`)
   - добавляет событие в `action_history` (REGISTER)

#### Регистрация on-chain

1. Пользователь вызывает `/api/blockchain/register/{id}`.
2. Backend отправляет транзакцию в контракт `FileRegistry.registerObject(...)`.
3. В PostgreSQL сохраняется `blockchain_tx_hash`, а в `action_history` добавляется `REGISTER_ON_CHAIN`.

#### Верификация

1. Пользователь загружает файл в `/api/verify/file`.
2. Backend пересчитывает SHA-256 и ищет в `digital_objects.sha256_hash`.
3. Возвращает VERIFIED / NOT VERIFIED и сохраняет запись в `verification_logs`.

