#!/bin/sh
set -eu

# Явно ждём PostgreSQL (depends_on + healthcheck не всегда исключают первый failed connect)
python wait_for_db.py || exit 1

# Миграции обязательны — не поднимаем API с устаревшей схемой
ok=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if alembic upgrade head; then
    ok=1
    break
  fi
  echo "Alembic attempt $i failed, retrying in 3s..."
  sleep 3
done

if [ "$ok" -ne 1 ]; then
  echo "FATAL: alembic upgrade head failed after retries — проверьте логи PostgreSQL и состояние alembic_version."
  exit 1
fi

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
