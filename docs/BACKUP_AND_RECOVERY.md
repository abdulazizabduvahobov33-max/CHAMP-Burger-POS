# Backup & Disaster Recovery — Sharof KFS

Written after a real backup → restore → reconciliation → live-backend drill (see §6). If you're
reading this a year from now with no memory of any of this, start at §7 ("Emergency recovery") —
everything above it is background/evidence for why the procedure is trusted.

**Context**: Sharof KFS already lost its original Render-hosted PostgreSQL once and had to
recover from a backup. This document exists so that never again means guessing.

---

## 1. Where production-critical data actually lives

| Data | Physical location | Notes |
|---|---|---|
| `users`, `sales`, `sale_items`, `products`, `product_variants`, `ingredients`, `stock`, `stock_movements`, `purchases`, `purchase_items`, `settings`, `refresh_tokens`, `categories`, `suppliers`, `tables`, `recipes`, `sale_change_logs`, `price_history`, `backups`, `ai_messages`, `locations` | **Neon Postgres** (Frankfurt project) | The one and only source of truth for all business data. 21 tables total (confirmed by `pg_dump`'s table-of-contents). |
| Product photos (some of them) | **Supabase Storage** bucket | See §11 — not all current photos are actually here (see below). |
| Product photos (the ones seeded at first boot) | **Git repository**, `server/src/uploads/*.jpg` | Committed files, copied to the backend's local filesystem at every deploy by `bootstrap/ensureMenuSeeded.ts`. Survives a redeploy because git is the source, not because the filesystem persists. |
| Any OTHER admin-uploaded photo, if Supabase isn't actually configured on the live service | Backend's **local filesystem** (`server/src/uploads/`, runtime-written) | Render web services do not have a persistent disk by default — **anything written here at runtime, that ISN'T also in git, is lost on the next deploy or restart.** Treat this path as explicitly NOT a backup target. |
| Backend/frontend source code, migrations | **GitHub repository** | Source of truth for CODE, never for production DATA. A fresh clone + deploy reproduces the schema (via migrations) but not one row of real data. |
| Environment variables / secrets | **Render dashboard only** (+ each developer's own gitignored `.env`) | Never in git. See `docs/PRODUCTION_ENV_INVENTORY.md` for names (not values). |

---

## 2. What a backup must cover (and what it doesn't need to)

- **PostgreSQL data** — every table above. This is the actual backup target; everything else
  below is either reproducible from git or is a separate, smaller concern.
- **Schema + migrations** — already fully captured by `server/prisma/migrations/*` in git. A
  `pg_dump` also captures the schema as it physically exists, which is a useful independent
  cross-check that migrations and reality agree (see §6).
- **External files/storage** — see §11. Assessed, not fully backed up yet (see the honest gap
  noted there).
- **Environment-variable inventory** (names only, no values) — `docs/PRODUCTION_ENV_INVENTORY.md`.
- **Deployment configuration** — captured in §12 (best-known Render settings per service).
- **Frontend/backend URLs, region configuration** — captured in §12 and
  `PRODUCTION_ENV_INVENTORY.md`.

Real secret **values** are never written to git, to this doc, or to any backup-adjacent file —
only names, purposes, and (for the DB) actual business data.

---

## 3–6. PostgreSQL backup procedure, and the drill that actually validated it

**Tool**: `pg_dump`/`pg_restore` in custom format (`--format=custom`), matching PostgreSQL 18
client tools to production's actual server version (confirmed via `SELECT version()` before
choosing which locally-installed major version to use — 16/17/18 were all available; 18 was
picked to match). Standard PostgreSQL tooling, no third-party backup service.

**Script**: `server/prisma/prodBackup.ts` — reads `PRODUCTION_DATABASE_URL` from the operator's
own local `.env` (never printed, never hardcoded), passes the non-secret connection parts
(host — partially masked in its own log output — port, user, db name) as normal `pg_dump` flags,
and passes the password via the `PGPASSWORD` environment variable (never appears on the process
command line the way a flag argument would). Output goes to a directory the caller supplies —
**never inside the git repository** (the repo's `.gitignore` already has a `backups/` rule with
exactly this reasoning from an earlier, Docker-oriented backup attempt — see the note in §13).

```
npx tsx prisma/prodBackup.ts <some-local-directory-outside-the-repo>
```

### What was actually done (this session, read-only against production the whole time)

1. **Dumped** production via the script above. Result: **167.8 KB**, custom-format archive,
   dumped 2026-09-08 (server clock), from PostgreSQL 18.6, by `pg_dump` 18.6.
2. **Validated structurally** via `pg_restore --list`: **142 TOC entries** — all 21 expected
   tables (+ their data sections + constraints + indexes) present, 7 custom enum types present,
   no format errors.
3. **Created a brand-new, empty, isolated database** (`champ_pos_restore_drill`) on the local
   Postgres 16 server used for this project's normal TEST DB — a completely separate database
   from both production and the everyday dev TEST DB.
4. **Restored** the dump into it with `pg_restore --no-owner --no-privileges` (role/privilege
   differences between Neon's managed roles and a local server are irrelevant to a data
   restore and would otherwise just produce harmless warnings).
5. **Row counts, restored vs. production** (the actual comparison, not an assumption):

   | Table | Production | Restored | Match? |
   |---|---|---|---|
   | sales | 661 | 661 | ✅ |
   | sale_items | 975 | 975 | ✅ |
   | stock_movements | 1 | 1 | ✅ |
   | users | 2 | 2 | ✅ |
   | products | 38 | 38 | ✅ |
   | product_variants | 57 | 57 | ✅ |
   | ingredients | 45 | 45 | ✅ |
   | purchases | 1 | 1 | ✅ |
   | refresh_tokens | 735 | 735 | ✅ |

   Every table matched exactly — no row-count check omitted, no persons'/customers' data shown
   here beyond counts.
6. **Reconciliation on the restored copy** (read-only, against the drill DB only):
   - `_prisma_migrations`: **20/20 applied, all finished**, latest = `20260907210732_drop_redundant_login_index` — matches what production itself reports.
   - `Sale.totalAmount == SUM(active SaleItem.subtotal)` across all 661 ACCEPTED sales: **0 mismatches**.
   - `Sale.clientRequestId` uniqueness: **0 duplicate groups**.
   - `SaleItem.unitCostSnapshot/costSnapshot/hasCostSnapshot` columns: present, queryable (975 legacy rows all `hasCostSnapshot=false`, consistent with the historical-cost-snapshot audit's own finding that this production data predates that feature).
   - `Stock.quantity == SUM(StockMovement.change)` across all 45 stock rows: **0 mismatches**.
   - Unique indexes (`sales_clientRequestId_key`, `users_login_key`, `users_login_lower_key`, `sale_items_saleId_idx`, ...): all present in `pg_indexes`.
7. **Live backend smoke test against the restored data** (the part that actually proves this is
   usable, not just structurally intact) — booted the real Express app
   (`prisma/recoveryDrillSmoke.ts`) with its `DATABASE_URL` pointed at the drill database, set a
   **known test password for the restored "admin" account IN THE DRILL DATABASE ONLY** (never
   touches the real production password), and ran real HTTP requests:

   | Check | Result |
   |---|---|
   | `GET /api/health` | PASS — `db: "up"` |
   | `POST /api/auth/login` (restored admin, drill-only password) | PASS |
   | `GET /api/auth/me` | PASS |
   | `GET /api/products` (menu) | PASS — 20 products returned |
   | `GET /api/reports/dashboard` | PASS — receiptCount=661, matches restored data |
   | `GET /api/reports/sales` | PASS |
   | `GET /api/ingredients` (warehouse) | PASS — 20 ingredients returned |

   **7/7 PASS.** This is a genuine, real restore — not a claim based on `pg_dump` exiting 0.

Because all of the above actually happened (not just the dump step), this document can honestly
say: **the backup is proven restorable**, and the recovery procedure below is based on steps that
were actually executed, not steps that are merely believed to work.

---

## 7. Emergency recovery procedure

Follow this in order. Do not skip validation steps to save time — a half-verified recovery is
how a second incident happens on top of the first.

1. **Understand the failure first.** Is it Neon (DB unreachable/corrupted), Render (a service
   deleted/misconfigured), the account itself (locked out), or something else? The right next
   step depends entirely on which.
2. **Do not delete the old/broken database**, even if it looks dead — a database that "won't
   connect" is not the same as "gone forever," and you may still be able to get a fresh dump out
   of it before concluding it's unrecoverable.
3. **Create a NEW database** (a new Neon project/branch, or — if Neon itself is the thing that's
   gone — any reachable PostgreSQL 16+ instance). Do not try to resurrect the old connection
   string; get a new one and treat it as the target.
4. **Restore the most recent backup** into the new database:
   ```
   pg_restore -h <new-host> -U <new-user> -d <new-db> --no-owner --no-privileges <backup-file>
   ```
5. **Validate row counts** against whatever the last known-good numbers were (this doc's §6
   table is the last confirmed baseline; check for a more recent record if backups have been
   taken since).
6. **Check migrations**: `npx prisma migrate status` against the new database. If anything is
   pending, that's expected if the backup predates a migration — apply it with
   `npx prisma migrate deploy` (safe, idempotent, only ever additive per this project's own
   migration discipline) before going further.
7. **Check critical data** the same way §6 did: `Sale.totalAmount` vs item sums, no duplicate
   `clientRequestId`, stock vs movement sums. Don't skip this because the row counts matched —
   row counts matching doesn't prove the DATA inside those rows is internally consistent.
8. **Update the backend's `DATABASE_URL`** (Render dashboard → the backend service's
   environment) to the new connection string. Do NOT put it in git.
9. **Deploy** (Render auto-deploys on env var change, or trigger a manual deploy).
10. **Check health**: `GET /api/health` should report `db: "up"`.
11. **Check auth**: log in as a real account. If this fails, stop — don't proceed to point real
    traffic at a backend that can't authenticate anyone.
12. **Check Cashier**: the menu loads, a test sale can be created (on a **real** test order the
    business is prepared to have exist, or use a controlled test account/table if the business
    can tolerate a throwaway entry — do not force a fake sale into production data if avoidable).
13. **Check Reports**: dashboard numbers look sane relative to what the business expects (not
    zero, not wildly wrong).
14. **Check Warehouse**: an ingredient's stock number looks sane.
15. **Only after all of the above pass**, consider the recovery complete and let real traffic
    flow normally again. Until then, if at all possible, keep the frontend pointed at nothing or
    show a maintenance state rather than a half-recovered backend.

---

## 8. Recovery Point Objective / Recovery Time — in plain terms

**RPO (how much data could be lost between backups)**: whatever happened since the last backup
ran. If backups run once a day, worst case is losing up to a day's sales/stock movements — for a
single-location café doing (currently) a few hundred sales a month, that's a real but survivable
loss (the business itself remembers today's orders even if the DB briefly doesn't); it would be a
much bigger deal once volume is high enough that a day's sales represents serious money and stock
accounting.

**RTO (how long recovery actually takes)**: based on the drill actually performed above — the
dump (167 KB, ~10 seconds), restore (~15 seconds), and reconciliation checks took well under a
minute total for THIS data volume. Add realistic overhead for the parts that aren't just SQL:
provisioning a new Neon database/branch (a few minutes), updating Render's env var and waiting
for a redeploy (a few minutes), and a careful human walking through §7's checklist without
rushing (10-20 minutes). **A realistic total for today's data volume: 30-60 minutes**, most of
which is deliberate verification, not the restore itself. This will grow somewhat as data volume
grows (a multi-GB dump takes real minutes, not seconds), but the restore mechanics don't change.

**Suggested backup schedule for a small restaurant POS at this stage:**
- **Daily**, once, at a low-traffic hour (e.g., 3 AM local) — matches the RPO tradeoff above:
  losing at most one day's data is an acceptable, well-understood risk for current volume.
- **Before any migration**, additionally (see §9) — regardless of how "safe" the migration looks.
- Consider moving to **twice daily** once sales volume grows enough that a full day's loss would
  be materially painful, or before/during a known high-volume period (e.g., a holiday rush).
- **Not proposing a paid automated backup service or cron infrastructure without your
  sign-off** — the `prisma/prodBackup.ts` script is ready to be scheduled (cron, a Render Cron
  Job, GitHub Actions on a schedule, or just a recurring manual run) whenever you decide how you
  want it triggered.

---

## 9. Backup-before-migration rule

**Before any production migration, regardless of how low-risk it looks:**
1. Run `prisma/prodBackup.ts` and confirm the output file exists and has a sane non-zero size.
2. Spot-check it with `pg_restore --list` (structural validation — seconds, no reason to skip).
3. Apply the migration (`prisma migrate deploy`).
4. Re-run the relevant regression/reconciliation checks (this project already has several —
   `concurrencyAudit.ts`, `warehouseAudit.ts`, `reportsAudit.ts`, `authSecurityAudit.ts`, and the
   read-only production checkers from earlier audits) against production, read-only, to confirm
   nothing looks wrong.
5. Know the rollback path BEFORE step 3, not after: for a purely additive migration (this
   project's standing rule — see CLAUDE.md/engagement history, "no destructive migrations"),
   rollback is simple — the new column/index/table is just unused if something goes wrong, and
   worst case a follow-up migration drops it. For anything that isn't purely additive, the
   rollback path IS "restore the pre-migration backup," which is exactly why step 1 isn't
   optional even for a change that "can't possibly go wrong."

Even the additive `20260907210732_drop_redundant_login_index` migration (§0 of this session's
own request) went through this reasoning: it's a `DROP INDEX`, an operation on a 2-row table,
about as low-risk as a migration gets — and it still has a clear recovery path (recreate the
index with `CREATE INDEX users_login_idx ON users(login)` — a single, obvious, reversible
statement) precisely because "low risk" was reasoned through, not assumed.

---

## 10. Environment recovery

See `docs/PRODUCTION_ENV_INVENTORY.md` — names and purposes only, no values, kept as a separate
document so it can be shared/reviewed without any secret-handling concern.

---

## 11. Supabase / file storage status

**Configured for**: product photo uploads (bucket name, project URL, and a service-role key are
all read from environment variables — see PRODUCTION_ENV_INVENTORY.md — never hardcoded).

**What was actually checked (read-only, via the restored drill database — never the live
Supabase bucket itself, and never downloaded)**: of 38 products, 18 have a photo. **All 18
currently reference a local `/uploads/...` path, not a Supabase URL** — meaning either no product
photo has been re-uploaded since the Supabase integration was added, or new uploads aren't
actually landing in Supabase in production. This was NOT further diagnosed by downloading bucket
contents (deliberately — the instruction was to size the problem first, not pull a production
bucket unnecessarily; there was also no local Supabase credential available to query the bucket
directly this session).

**Is this actually a risk today?** For the current 18 images: **no** — confirmed (read the
source) that these are seeded from `server/src/uploads/*.jpg`, which **are committed to git**
(`bootstrap/ensureMenuSeeded.ts` copies them in at every fresh boot). A live check against the
production URL confirmed all 3 sampled images currently return `200`. So today's photos survive
a redeploy because git is their real source, not because the filesystem persists.

**What IS a real, unverified risk**: any FUTURE product photo an admin uploads through the admin
panel writes to the backend's local filesystem UNLESS Supabase is actually configured and
working on the live Frankfurt service — and Render web services do not have a persistent disk by
default, so such a file would be silently lost on the next deploy or restart. This was not tested
end-to-end (would require an actual upload against production, a real write action outside this
audit's read-only scope) and is flagged below as MANUAL CHECK NEEDED.

**Recommendation, not yet actioned**: confirm `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`/
`SUPABASE_BUCKET_NAME` are actually set on the Frankfurt Render service (dashboard check), then
do one real test upload through the admin UI and confirm the resulting `imageUrl` is a Supabase
URL, not a local path.

---

## 12. Render disaster scenarios

All three below are **documented procedure**, not yet executed against real Render infrastructure
(that would mean deleting/recreating a real service — out of scope for a read-only audit, and
explicitly not authorized). Settings below are the **best-known configuration inferred from this
repository's structure and this engagement's history**, not a confirmed read of the Render
dashboard (no dashboard access this session) — treat anything not independently confirmable as
MANUAL CHECK NEEDED before relying on it verbatim.

### Scenario A — Frankfurt backend deleted

To recreate as a new Render Web Service:
- **Repo**: this GitHub repository (main branch's current state is source of truth for code).
- **Branch**: `main`.
- **Region**: Frankfurt (matches Neon's Frankfurt project — same-region round trips are the
  entire reason this backend was moved here; recreating it anywhere else reintroduces the
  ~40x latency regression this project already diagnosed and fixed once).
- **Root directory**: `server`.
- **Build command**: `npm install && npm run build` (→ `prisma generate && tsc -p tsconfig.json`,
  per `server/package.json`).
- **Start command**: `npm run start` (→ `node dist/index.js`).
- **Health check path**: `/api/health`.
- **Required env vars**: every backend variable in `PRODUCTION_ENV_INVENTORY.md`'s backend
  table, with real values from the Render dashboard's secret store (or a password manager, if
  the dashboard itself is what's gone — see the account-loss scenario, out of scope for a
  same-account service recreation).
- **After creating**: point its `DATABASE_URL` at the (presumably still-alive) Neon database,
  deploy, confirm `/api/health`, then update the FRONTEND's `VITE_API_URL` to the new backend's
  URL and rebuild+redeploy the frontend (§Scenario B) — the frontend bakes this in at build
  time, so a backend URL change alone does nothing until the frontend is rebuilt.

### Scenario B — Frontend deleted

- **Repo/branch**: same as above, `client` as the root directory.
- **Build command**: `npm install && npm run build` (Vite).
- **Publish directory**: `client/dist`.
- **Required env var**: `VITE_API_URL` set to the backend's real URL, BEFORE building (build-time
  only — see PRODUCTION_ENV_INVENTORY.md's warning about this).
- Recreating this doesn't touch data at all — it's a pure static rebuild from git.

### Scenario C — Neon DB lost

This is exactly §7's Emergency recovery procedure. The one Neon-specific note: Neon supports
project-level branching/point-in-time recovery on some plans — check the Neon dashboard for
whether a PITR/branch restore is available and faster than a full `pg_dump`/`pg_restore` cycle
BEFORE reaching for the from-scratch procedure; if it's not available (or the whole project is
gone, not just a branch), fall back to §7 exactly as drilled in §6.

---

## 13. Migration-deployment strategy — proposal only, nothing changed

**The problem, confirmed twice now** (this session, and in the Reports/Financial audit before
it): a migration this session's own report assumed "applies automatically on Frankfurt's next
deploy" — but Frankfurt's Start Command is `npm run start` (`node dist/index.js`), which does
**not** run `prisma migrate deploy`. Both times, the migration turned out to be applied anyway —
almost certainly because the OLD Oregon service (whose deploy process, or whose Build Command,
apparently does include a migrate step) auto-deployed from the same `main` branch and hit the
same Neon database. That's a **lucky coincidence of two services sharing a database**, not a
designed guarantee — if Oregon is ever decommissioned, paused, or has its auto-deploy disabled,
Frankfurt would silently stop receiving schema migrations with no error at deploy time (the app
would just start failing at the first query that needs the new column/table/index).

**Proposed standard** (architecture/process only — Start Command not touched):
1. **Migrations should run exactly once, deliberately, not as a side effect of whichever service
   happens to redeploy first.** Render supports a distinct "Pre-Deploy Command" separate from the
   Start Command on paid plans — moving `npx prisma migrate deploy` there (on Frankfurt
   specifically, the one real production service) makes this explicit and no longer dependent on
   Oregon's behavior at all.
2. **Oregon should not be able to apply migrations against the shared production database
   going forward** if it's being kept only as a rollback option — either disable its
   auto-deploy, or accept explicitly that it's allowed to (and document that choice, rather than
   have it be an accident).
3. **A test/staging service must never point at the production database.** This project's TEST
   DB is already local-only and separate — worth stating as an explicit rule so a future staging
   environment doesn't get wired to production Neon by mistake.
4. **The production deploy procedure should be a single documented sequence**: backup (§9) →
   migrate (via the pre-deploy step above, or manually before deploying if pre-deploy commands
   aren't available on the current plan) → deploy → verify (`/api/health`, a quick read-only
   smoke check) — not "push to main and hope."

This is a recommendation for you to decide on, not a change made — the actual Render Start/Build
Command configuration was not touched this session.

---

## 14. Git / repository recovery checks

- **Production commit**: not independently determinable this session (no Render dashboard
  access to see which commit is actually deployed) — same MANUAL CHECK NEEDED noted in earlier
  audits this engagement. `git log` on `main` shows the code that WOULD be deployed on a fresh
  deploy from HEAD.
- **Migrations are in git**: yes, all 20 confirmed present under `server/prisma/migrations/`.
- **`.env` is gitignored**: confirmed (`.gitignore` line 5).
- **Backup files won't reach git**: confirmed — `.gitignore` already has a `backups/` rule
  (pre-existing, written for the older Docker-oriented `scripts/backup-db.sh`/`restore-db.sh`;
  those two scripts target a `docker compose` Postgres service that current production does
  NOT use — they're still valid for the Docker self-hosted deployment path described in
  `docs/DEPLOYMENT.md`, but are not what protects the actual Neon-hosted production data. This
  document and `prisma/prodBackup.ts` are what actually applies to the real deployed
  architecture.). This session's own backup file was written to a directory outside the repo
  entirely, not even relying on that gitignore rule.
- **No secrets found in a reasonable history scan**: checked for committed `.env`/`.dump`/`.sql`
  files across all branches — only Prisma migration `.sql` files (schema only, no data, no
  credentials) were found.

---

## 15. Recovery drill result

**Performed, this session, real** — see §6 for the full step-by-step. Summary: backup → brand-new
isolated local database → restore → row-count match (9/9 tables checked) → data-consistency
reconciliation (0 mismatches across 4 different checks) → real backend booted against the
restored data → 7/7 live HTTP smoke checks passed (health, login, session, menu, dashboard,
sales list, warehouse). Production frontend was never touched or pointed anywhere; the drill
used only a local backend instance and the isolated restored database.

## 16. Cleanup

- **Production backup file**: kept (per instruction — a validated backup is not something to
  delete after one drill). Location: this session's scratchpad directory (outside the repo,
  outside git) — an attempt to also copy it into the repo-root `backups/` folder (already
  gitignored, see §14) was blocked by this session's own tooling permissions, so it currently
  exists ONLY in the scratchpad, which is not guaranteed to persist past this session. **Move it
  somewhere durable yourself** (that `backups/` folder, cloud storage, wherever you keep
  operational files) before assuming it's safe long-term — whoever owns ongoing backup
  responsibility should also decide on a real recurring schedule (see §8) rather than rely on
  this one manual copy.
- **`champ_pos_restore_drill` database**: this was purpose-built for this drill and is safe to
  drop once you confirm you don't want to keep it around for further manual poking — it's a
  local database, isolated from both production and the normal dev TEST DB, containing a static
  read-only snapshot from this session's backup.
- **Production database**: not touched at any point this session — every production access was
  wrapped in a `SET TRANSACTION READ ONLY` transaction (verified in an earlier audit to actually
  make Postgres reject a write, not just "the script didn't try one").
