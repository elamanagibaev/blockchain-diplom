.PHONY: up down build seed logs

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
