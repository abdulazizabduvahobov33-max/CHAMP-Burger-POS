#!/bin/sh
# Runs on every container start (not just the first): `prisma migrate deploy` is safe to
# re-run — it only applies migrations that haven't been applied yet and is a no-op
# otherwise, so restarts/redeploys always leave the schema up to date automatically.
set -e

echo "→ Applying database migrations..."
npx prisma migrate deploy

echo "→ Starting server..."
exec node dist/index.js
