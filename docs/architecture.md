## Архитектура (MVP)

### Компоненты

- **Frontend (`frontend/`)**: React SPA.
- **Backend (`backend/`)**: FastAPI API + бизнес-логика.
- **Blockchain (`blockchain/`)**: Hardhat node + Solidity контракт `FileRegistry`.
- **DB**: PostgreSQL (off-chain метаданные, журнал верификаций, события блокчейна).
- **Storage**: Off-chain хранилище файлов (локально; MinIO поднимается для демонстрации).

### Потоки данных

#### Регистрация объекта

1. Пользователь загружает файл в `/api/files/upload` (multipart).
2. Backend:
   - проверяет размер/тип
   - считает SHA-256
   - сохраняет файл off-chain (storage)
   - пишет метаданные в PostgreSQL (`digital_objects`)

#### Регистрация on-chain

1. Пользователь вызывает `/api/blockchain/register/{id}`.
2. Backend отправляет транзакцию в контракт `FileRegistry.registerObject(...)`.
3. В PostgreSQL сохраняется `blockchain_tx_hash`, в таблицу `blockchain_events` добавляется запись о регистрации.

#### Верификация

1. Пользователь загружает файл в `/api/verify/file`.
2. Backend пересчитывает SHA-256 и ищет в `digital_objects.sha256_hash`.
3. Возвращает VERIFIED / NOT VERIFIED и сохраняет запись в `verification_logs`.

