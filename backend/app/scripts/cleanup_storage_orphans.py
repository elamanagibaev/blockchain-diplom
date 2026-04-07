"""
Удаление «осиротевших» файлов в хранилищах: локальный каталог и MinIO.

Сохраняет только объекты, перечисленные в digital_objects (по storage_key + storage_backend).
Таблицу users не изменяет.

Запуск (из каталога backend с PYTHONPATH=/app или из контейнера):
  python -m app.scripts.cleanup_storage_orphans          # только отчёт
  python -m app.scripts.cleanup_storage_orphans --apply  # удалить осиротевшее

docker compose exec backend python -m app.scripts.cleanup_storage_orphans --apply
"""
from __future__ import annotations

import argparse
import os
import sys

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import SessionLocal
from app.models.digital_object import DigitalObject


def _collect_db_keys(session: Session) -> tuple[set[str], set[str]]:
    rows = session.query(DigitalObject.storage_key, DigitalObject.storage_backend).all()
    local_keys: set[str] = set()
    minio_keys: set[str] = set()
    for sk, backend in rows:
        if not sk:
            continue
        b = (backend or "local").lower()
        if b == "minio":
            minio_keys.add(sk)
        else:
            local_keys.add(sk)
    return local_keys, minio_keys


def _cleanup_local(base_path: str, referenced: set[str], apply: bool) -> tuple[int, list[str]]:
    removed = 0
    paths: list[str] = []
    if not os.path.isdir(base_path):
        return 0, []
    for name in os.listdir(base_path):
        path = os.path.join(base_path, name)
        if not os.path.isfile(path):
            continue
        if name in referenced:
            continue
        paths.append(path)
        if apply:
            try:
                os.remove(path)
                removed += 1
            except OSError as e:
                print(f"  [ошибка] {path}: {e}", file=sys.stderr)
    return removed, paths


def _cleanup_minio(referenced: set[str], apply: bool) -> tuple[int, list[str]]:
    settings = get_settings()
    if not all(
        [
            settings.MINIO_ENDPOINT,
            settings.MINIO_ACCESS_KEY,
            settings.MINIO_SECRET_KEY,
            settings.MINIO_BUCKET_NAME,
        ]
    ):
        print("MinIO не настроен — пропуск очистки бакета.")
        return 0, []

    from minio import Minio

    client = Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
    )
    bucket = settings.MINIO_BUCKET_NAME
    if not client.bucket_exists(bucket):
        print(f"Бакет {bucket} отсутствует — пропуск.")
        return 0, []

    removed = 0
    names: list[str] = []
    for obj in client.list_objects(bucket, recursive=True):
        key = obj.object_name
        if not key or key.endswith("/"):
            continue
        if key in referenced:
            continue
        names.append(key)
        if apply:
            try:
                client.remove_object(bucket, key)
                removed += 1
            except Exception as e:
                print(f"  [ошибка] minio://{bucket}/{key}: {e}", file=sys.stderr)
    return removed, names


def main() -> int:
    parser = argparse.ArgumentParser(description="Очистка осиротевших файлов в local / MinIO (users не трогаем).")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Реально удалить файлы (без флага — только отчёт)",
    )
    args = parser.parse_args()
    settings = get_settings()
    apply = args.apply

    session: Session = SessionLocal()
    try:
        local_ref, minio_ref = _collect_db_keys(session)
        print(f"В БД: local-ключей={len(local_ref)}, minio-ключей={len(minio_ref)}")
    finally:
        session.close()

    # Локальное хранилище
    base = settings.FILE_STORAGE_PATH
    print(f"\nЛокальный каталог: {base}")
    n_loc, paths_loc = _cleanup_local(base, local_ref, apply)
    if not paths_loc:
        print("  Осиротевших файлов не найдено.")
    else:
        print(f"  Найдено осиротевших файлов: {len(paths_loc)}")
        for p in paths_loc[:50]:
            print(f"    - {p}")
        if len(paths_loc) > 50:
            print(f"    ... и ещё {len(paths_loc) - 50}")
        if apply:
            print(f"  Удалено: {n_loc}")
        else:
            print("  (режим просмотра; запустите с --apply для удаления)")

    # MinIO
    print(f"\nMinIO бакет: {settings.MINIO_BUCKET_NAME or '(не задан)'}")
    n_m, keys_m = _cleanup_minio(minio_ref, apply)
    if not keys_m and settings.MINIO_BUCKET_NAME:
        print("  Осиротевших объектов не найдено.")
    elif keys_m:
        print(f"  Найдено осиротевших объектов: {len(keys_m)}")
        for k in keys_m[:50]:
            print(f"    - {k}")
        if len(keys_m) > 50:
            print(f"    ... и ещё {len(keys_m) - 50}")
        if apply:
            print(f"  Удалено: {n_m}")
        else:
            print("  (режим просмотра; запустите с --apply для удаления)")

    print("\nГотово. Таблица users не изменялась.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
