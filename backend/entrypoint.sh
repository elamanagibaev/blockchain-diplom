#!/bin/sh
set -e

# Retry alembic in case DB is not immediately ready
for i in 1 2 3 4 5; do
  if alembic upgrade head; then
    break
  fi
  echo "Alembic attempt $i failed, retrying in 3s..."
  sleep 3
done

exec uvicorn app.main:app --host 0.0.0.0 --port 8000
