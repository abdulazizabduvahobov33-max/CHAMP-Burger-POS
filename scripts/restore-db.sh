#!/bin/sh
# Restores a .sql.gz backup produced by backup-db.sh into the `postgres` Docker Compose
# service. DESTRUCTIVE — drops and recreates every table's contents in the target database.
#
# Usage:   ./scripts/restore-db.sh backups/champ_pos_20260709_030000.sql.gz
set -eu

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  # shellcheck disable=SC1091
  . ./.env
fi

: "${POSTGRES_USER:?Missing POSTGRES_USER — copy .env.example to .env first}"
: "${POSTGRES_DB:?Missing POSTGRES_DB — copy .env.example to .env first}"

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ] || [ ! -f "$BACKUP_FILE" ]; then
  echo "Usage: $0 <path-to-backup.sql.gz>"
  echo "Available backups:"
  ls -1 ./backups/*.sql.gz 2>/dev/null || echo "  (none found in ./backups)"
  exit 1
fi

echo "⚠️  This will OVERWRITE the current contents of database '$POSTGRES_DB'."
echo "    Restoring from: $BACKUP_FILE"
printf "    Type YES to continue: "
read -r CONFIRM
if [ "$CONFIRM" != "YES" ]; then
  echo "Aborted."
  exit 1
fi

echo "→ Restoring..."
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U "$POSTGRES_USER" "$POSTGRES_DB"

echo "→ Restore complete. Restarting backend so Prisma's connection pool picks up a clean state..."
docker compose restart backend

echo "→ Done."
