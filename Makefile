LOCAL = docker compose -f docker/docker-compose.yml
ALEMBIC = alembic -c db/alembic.ini

.PHONY: up down logs shell psql makemigrations migrate downgrade history complete covers lint test erd reset-db help

## --- Local (FE :5173, API :8000, Postgres :5432) -----------------------------

envs/.env.local:
	cp envs/.env.local.example $@

up: envs/.env.local ## Start db, API and FE (migrations run on start, hot reload)
	$(LOCAL) up --build -d
	@echo "FE: http://localhost:5173"
	@echo "API docs: http://localhost:8000/docs"

down:          ## Stop local stack (keeps data)
	$(LOCAL) down

logs:          ## Tail logs (all services; emails are printed here)
	$(LOCAL) logs -f

shell:         ## Shell inside the API container
	$(LOCAL) exec api bash

psql:          ## psql into the local database
	$(LOCAL) exec db sh -c 'psql -U $$POSTGRES_USER -d $$POSTGRES_DB'

makemigrations: ## Autogenerate a migration: make makemigrations m="add foo table"
	@test -n "$(m)" || (echo 'usage: make makemigrations m="describe change"' && exit 1)
	$(LOCAL) exec api $(ALEMBIC) revision --autogenerate -m "$(m)"

migrate:       ## Apply pending migrations
	$(LOCAL) exec api $(ALEMBIC) upgrade head

downgrade:     ## Roll back one migration
	$(LOCAL) exec api $(ALEMBIC) downgrade -1

history:       ## Show migration history
	$(LOCAL) exec api $(ALEMBIC) history --verbose

complete:      ## Fill in the titles in other languages and editions the database doesn't have yet
	$(LOCAL) exec api python -m api.commands.complete

covers:        ## Find covers for the books without one, and copy all covers to our storage (media/ locally; again=1 to replace ours)
	$(LOCAL) exec api python -m api.commands.covers $(if $(again),--again)

lint:          ## Ruff on the API (needs uv: https://docs.astral.sh/uv/)
	uv run ruff check && uv run ruff format --check

test:          ## Run the API's tests (needs uv, and the local database: make up)
	uv run pytest

erd:           ## Draw the data model in docs/data-model.md, from api/models/ (needs uv)
	uv run python -m api.commands.erd

reset-db:      ## Wipe the local database and start fresh
	$(LOCAL) down -v
	$(LOCAL) up --build -d

help:
	@grep -E '^[a-z-]+:.*## ' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-17s %s\n", $$1, $$2}'

