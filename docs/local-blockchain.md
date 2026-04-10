# Local Blockchain and Explorer (Demo)

## Что используется

- Локальная EVM сеть: `Hardhat` (сервис `blockchain`)
- Локальный explorer:
  - приоритетно рассматривался `Blockscout`
  - для стабильной защиты выбран рабочий fallback `explorer` (лёгкий локальный tx viewer)
- Всё запускается через `docker compose`

## Почему fallback вместо Blockscout

`Blockscout` требует дополнительный стек (индексатор, БД, очереди, миграции), что для локальной защиты на одном ноутбуке часто даёт долгий нестабильный старт.  
Для демо выбран лёгкий локальный explorer, который:

- работает в локальной сети;
- показывает транзакции из текущей Hardhat-сети;
- даёт локальные ссылки вида `http://localhost:4000/tx/<hash>`;
- не уводит в публичные обозреватели.

## Запуск инфраструктуры

Из корня репозитория:

```bash
docker compose up --build
```

Ожидаемые URL:

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:8000/api`
- Hardhat RPC: `http://localhost:8545`
- Local explorer: `http://localhost:4000`

Проверка health:

```bash
curl http://localhost:4000/health
curl http://localhost:8000/api/health
```

## Нужные env

### Backend

- `WEB3_PROVIDER_URL=http://blockchain:8545`
- `CHAIN_ID=31337`
- `CONTRACT_ADDRESS=` (пусто, если читаем из файла после автодеплоя)
- `CONTRACT_ADDRESS_FILE=/shared/contract_address.txt`
- `BLOCK_EXPLORER_URL=http://localhost:4000`

### Frontend

- `VITE_BLOCK_EXPLORER_URL=http://localhost:4000` (fallback, если API не прислал `tx_explorer_url`)

## Деплой контракта локально

В docker-сценарии деплой выполняется автоматически сервисом `blockchain` при старте.

Артефакты:

- адрес: `/shared/contract_address.txt`
- ABI: `/shared/FileRegistry.abi.json`

Backend использует этот адрес автоматически, если `CONTRACT_ADDRESS` не задан.

Ручной запуск (опционально):

```bash
cd blockchain
npm install
npm run node
npm run deploy:local
```

## Формат ссылок explorer в API/UI

Backend собирает ссылку как:

- `${BLOCK_EXPLORER_URL}/tx/${tx_hash}`

Пример:

- `http://localhost:4000/tx/0xabc123...`

## Проверка, что explorer видит локальные tx

1. Загрузить документ (роль `department`)
2. Подтвердить этап деканатом (роль `dean`)
3. Дождаться on-chain регистрации (или запустить fallback endpoint/seed)
4. Проверить в API `GET /api/files/{id}`:
   - `blockchain_tx_hash` не пустой
   - `tx_explorer_url` ведёт на `http://localhost:4000/tx/...`
5. Открыть ссылку в браузере и убедиться, что транзакция отображается

## Demo seed

Быстрый seed:

```bash
docker compose run --rm backend python -m app.scripts.seed_demo
```

Скрипт печатает данные для демо, включая:

- `document_id`
- `tx_hash`
- `tx_explorer_url`
