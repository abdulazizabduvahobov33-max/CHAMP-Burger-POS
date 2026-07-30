#!/bin/sh
# Dumps the Postgres database running in the `postgres` Docker Compose service to a
# timestamped, gzip-compressed .sql file and prunes backups older than $RETENTION_DAYS.
#
# Usage:   ./scripts/backup-db.sh
# Cron:    0 3 * * *  cd /opt/champ-pos && ./scripts/backup-db.sh >> /var/log/champ-pos/backup.log 2>&1
#
# Bare-metal (no Docker) variant: replace the `docker compose exec -T postgres pg_dump ...`
# line below with a direct `pg_dump -h localhost -U "$POSTGRES_USER" "$POSTGRES_DB"` — same
# output pipe (gzip > file), same retention logic.
set -eu

cd "$(dirname "$0")/.."

if [ -f .env ]; then
  # shellcheck disable=SC1091
  . ./.env
fi

: "${POSTGRES_USER:?Missing POSTGRES_USER — copy .env.example to .env first}"
: "${POSTGRES_DB:?Missing POSTGRES_DB — copy .env.example to .env first}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
OUT_FILE="$BACKUP_DIR/champ_pos_${TIMESTAMP}.sql.gz"

echo "→ Dumping database '$POSTGRES_DB'..."
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$OUT_FILE"

SIZE=$(du -h "$OUT_FILE" | cut -f1)
echo "→ Wrote $OUT_FILE ($SIZE)"

echo "→ Pruning backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name 'champ_pos_*.sql.gz' -mtime "+$RETENTION_DAYS" -print -delete

echo "→ Done. Current backups:"
ls -lh "$BACKUP_DIR"
