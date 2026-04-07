"""Дождаться доступности PostgreSQL перед alembic (устраняет гонки при cold start)."""
import os
import sys
import time

import psycopg2

MAX_WAIT_S = 90
INTERVAL_S = 1


def _widen_alembic_version_column(conn) -> None:
    """Alembic создаёт version_num как VARCHAR(32); длинные revision id ломают UPDATE."""
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'public' AND table_name = 'alembic_version'
                )
                """
            )
            if not cur.fetchone()[0]:
                return
            cur.execute(
                """
                ALTER TABLE alembic_version
                ALTER COLUMN version_num TYPE VARCHAR(128)
                """
            )
        conn.commit()
        print("wait_for_db: alembic_version.version_num -> VARCHAR(128)", flush=True)
    except Exception as e:
        conn.rollback()
        print(f"wait_for_db: widen alembic_version (пропуск): {e}", flush=True)


def main() -> int:
    host = os.environ.get("POSTGRES_SERVER", "db")
    db = os.environ.get("POSTGRES_DB", "file_registry")
    user = os.environ.get("POSTGRES_USER", "app")
    password = os.environ.get("POSTGRES_PASSWORD", "app")
    port = os.environ.get("POSTGRES_PORT", "5432")

    deadline = time.monotonic() + MAX_WAIT_S
    attempt = 0
    while time.monotonic() < deadline:
        attempt += 1
        try:
            conn = psycopg2.connect(
                host=host,
                port=port,
                dbname=db,
                user=user,
                password=password,
                connect_timeout=5,
            )
            try:
                _widen_alembic_version_column(conn)
            finally:
                conn.close()
            print(f"wait_for_db: OK (попытка {attempt})", flush=True)
            return 0
        except Exception as e:
            print(f"wait_for_db: попытка {attempt}: {e}", flush=True)
            time.sleep(INTERVAL_S)

    print("wait_for_db: таймаут — PostgreSQL недоступен", flush=True)
    return 1


if __name__ == "__main__":
    sys.exit(main())
