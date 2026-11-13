#!/bin/sh
# Production start: migrate, then serve.
set -eu

echo "==> migrations"
alembic -c db/alembic.ini upgrade head

# In the background, so the site starts straight away. Only what's missing is fetched, and a
# failure doesn't stop the site.
echo "==> titles, editions and covers (in the background)"
(python -m backend.commands.complete; python -m backend.commands.covers) &

# One process, so the in-memory rate limits hold for the whole API. --proxy-headers gives those
# limits the browser's IP from App Service's front end.
echo "==> uvicorn"
exec uvicorn backend.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips '*'
