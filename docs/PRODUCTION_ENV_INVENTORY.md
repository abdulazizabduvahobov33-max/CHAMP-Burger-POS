# Production environment variable inventory

Names and purposes only — **no secret values**. If a service is ever lost and recreated, this
is the checklist of what needs to be set again; the actual values live only in the Render
dashboard (and, for local dev, in the gitignored `server/.env` / `client/.env`).

## Services (as of this writing)

| Service | Purpose | Region |
|---|---|---|
| `champ-pos-frontend` (Render Static Site) | Serves the built React app | — (static, no region) |
| `champ-pos-backend-fra-test` (Render Web Service) | **Current production backend** | Frankfurt |
| `champ-pos-backend` (Render Web Service) | Old Oregon backend — see "Old Oregon rollback service" below | Oregon |
| Neon Postgres (Frankfurt project) | Production database | Frankfurt |
| Supabase project | Product photo storage (bucket — see BACKUP_AND_RECOVERY.md §11) | (check Supabase dashboard) |

**Old Oregon rollback service**: `champ-pos-backend.onrender.com` was the original backend
before the Frankfurt cutover (done for latency — Oregon↔Neon-Frankfurt round trips were
~40x slower than Frankfurt↔Neon-Frankfurt). Confirmed in an earlier audit (via latency
fingerprinting) that Oregon was still pointed at the *same* Neon database, not a stale one — so
if Frankfurt ever needs to be abandoned, Oregon is a working (if slow) fallback, not a dead end.
Its own env vars need the same inventory below if it's ever relied on again.

## Backend (`server/`) environment variables

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `production` on Render — gates error-message verbosity (middleware/error.ts), cookie `secure`/`sameSite` (auth.controller.ts) |
| `PORT` | Port the server listens on (Render sets this itself) |
| `DATABASE_URL` | Runtime PostgreSQL connection (Neon, pooled) — read by Prisma |
| `CLIENT_URL` | Comma-separated list of allowed CORS origins (the frontend's real URL(s)) |
| `JWT_ACCESS_SECRET` | Signs/verifies access tokens (15 min default) |
| `JWT_REFRESH_SECRET` | Signs/verifies refresh tokens (7 day default) — **must differ from JWT_ACCESS_SECRET** |
| `JWT_ACCESS_EXPIRES` | Access token TTL (optional, defaults to `15m`) |
| `JWT_REFRESH_EXPIRES` | Refresh token TTL (optional, defaults to `7d`) |
| `TRUST_PROXY` | Set `true` only when a real reverse proxy sits in front (Render's own edge counts) — controls whether `X-Forwarded-For` is trusted for rate-limiting |
| `OWNER_LOGIN` | The owner-panel account's login — deliberately has NO fallback/default; unset means the owner panel simply has no account yet (see bootstrap/ensureOwnerExists.ts) |
| `OWNER_PASSWORD` | The owner-panel account's password (used once, at first bootstrap, to create the account — rotating this later does NOT change the already-created account's password) |
| `SEED_ADMIN_LOGIN` / `SEED_ADMIN_PASSWORD` / `SEED_ADMIN_NAME` | First-run SUPER_ADMIN bootstrap account |
| `SEED_SELLER_LOGIN` / `SEED_SELLER_PASSWORD` / `SEED_SELLER_NAME` | First-run SELLER bootstrap account |
| `SUPABASE_URL` | Supabase project URL — product photo storage |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service-role key (server-side only, full bucket access) |
| `SUPABASE_BUCKET_NAME` | Which bucket product photos are uploaded to |
| `AI_PROVIDER` | `local` (default, free, no external calls) or a real provider name once implemented |
| `OPENAI_API_KEY` | Only read if `AI_PROVIDER=openai` (provider not yet implemented) |
| `ANTHROPIC_API_KEY` | Only read if `AI_PROVIDER=claude` (provider not yet implemented) |
| `TZ` | Optional defense-in-depth only — report date-boundary correctness does NOT depend on this (see shared/utils/dateRange.ts, which computes everything explicitly in Asia/Tashkent regardless) |

## Frontend (`client/`) environment variables

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | Backend's full URL, baked in at **build time** — a split-host deploy (frontend and backend on different Render services) requires the full `https://...` URL, not a relative `/api`; changing this requires a full rebuild+redeploy of the frontend, not just a dashboard env change |

## Local-development-only (never used by the deployed app)

| Variable | Purpose |
|---|---|
| `PRODUCTION_DATABASE_URL` | Set locally by whoever runs read-only production diagnostics/backups from their own machine — the app itself never reads this. Never commit a real value; keep it in the gitignored `server/.env` only. |
| `BACKUP_RETENTION_DAYS` | Only used by the OLD Docker-oriented `scripts/backup-db.sh` (see BACKUP_AND_RECOVERY.md — that script targets a `docker compose` setup, not the actual Neon+Render production) |
| `POSTGRES_USER` / `POSTGRES_DB` | Same — Docker Compose path only, not applicable to current production |

## If you have to recreate a service from scratch

See `docs/BACKUP_AND_RECOVERY.md` §12 for the exact Render service settings (repo, branch, region,
build/start command, health check path) for each service.
