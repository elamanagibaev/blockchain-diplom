.PHONY: up down build seed logs cleanup-storage-dry cleanup-storage-apply

up:
	docker compose up --build -d

down:
	docker compose down

build:
	docker compose build

seed:
	docker compose run --rm backend python -m app.scripts.seed_demo

logs:
	docker compose logs -f

# Удалить из /data/files и MinIO только файлы, не привязанные к digital_objects (users не трогаем).
# Сначала: make cleanup-storage-dry — затем: make cleanup-storage-apply
cleanup-storage-dry:
	docker compose exec backend python -m app.scripts.cleanup_storage_orphans

cleanup-storage-apply:
	docker compose exec backend python -m app.scripts.cleanup_storage_orphans --apply
