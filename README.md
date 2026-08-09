# Sharof KFS — POS + Inventory

Monorepo for the Sharof KFS fast-food management system (POS + склад).

## Structure

```
champ-pos/
├── server/   # Node.js + Express + TypeScript + Prisma + PostgreSQL
└── client/   # React + TypeScript + Vite + TailwindCSS
```

## Module 1 — Project skeleton + Database (DONE)

- Monorepo (client / server)
- TypeScript configured on both sides
- Vite + TailwindCSS on client
- Express on server
- Prisma + PostgreSQL
- Full `schema.prisma` (MVP tables + future-ready tables: PriceHistory, Setting, Backup, multi-location fields)
- First migration
- Seed: Super Admin, main Location, categories, all menu products with variants

## Module 2 — Authentication (DONE)

- Login by username + password (bcrypt-hashed passwords)
- JWT access token (15m, in-memory on the client) + rotating JWT refresh token (7d, httpOnly cookie, DB-backed so logout/rotation can revoke it)
- `authenticate` (verifies access token) and `authorize(...roles)` (role gate) Express middleware — reusable by every future module's routes
- Two roles: `SUPER_ADMIN`, `SELLER`
- Client: Login page (Sharof KFS graphite/red-orange), role-based redirect after login (`/admin` vs `/pos`), protected routes, silent session restore on page reload, global 401 → refresh → retry handling
- Brute-force guard on `/api/auth/login` (10 attempts / 15 min)

## Module 3 — Warehouse: Ingredients & Stock (DONE)

- Ingredient CRUD (soft-delete via `isActive`, preserves stock/movement history)
- Per-location stock table (quantity, minimum-quantity threshold, low-stock flag)
- Units: шт (piece), кг, г, л, мл
- Manual restock and manual write-off, each recorded as an auditable `StockMovement`
- Movement history per ingredient, paginated
- Search, unit filter, low-stock filter, pagination on the ingredients table
- Consistently styled, fully responsive UI (table on desktop, cards on mobile) under Admin Dashboard → Склад
- All endpoints under `/api/ingredients` require `SUPER_ADMIN` (reuses Module 2's `authenticate`/`authorize` middleware unchanged)

## Module 4 — Products (DONE)

- Product CRUD with categories (own `Category` model, replacing the old free-text field), sale type (штучный / по весу / прямая продажа), multiple price variants per product, activate/deactivate toggle
- Photo upload (JPEG/PNG/WEBP, ≤5 MB) served publicly from `/uploads`, writes admin-only via `/api/uploads`
- Search, category/sale-type/status filters, pagination on the products grid
- Category management dialog (create/rename/delete, delete blocked while in use)
- Consistently styled, fully responsive UI under Admin Dashboard → Товары
- All endpoints require `SUPER_ADMIN` (reuses Module 2's `authenticate`/`authorize` middleware unchanged); warehouse module untouched

## Module 5 — Recipes (DONE)

- Per-variant recipe: list of `{ingredient, quantity}` lines, reusing the `Recipe` model already defined in Module 1's schema (no new tables/columns — unit comes from the linked `Ingredient`, not duplicated)
- Full replace-on-save editor per product variant, opened from the existing Products grid (`Рецепт` icon on each card)
- POS-ready stock deduction primitive (`consumeRecipeStock` / `POST /api/recipes/:variantId/consume`): given a sale quantity, deducts every recipe ingredient from stock in one all-or-nothing transaction, logs a `StockReason.SALE` movement per ingredient — race-safe (conditional atomic `updateMany`, load-tested with concurrent requests). Not wired to any UI yet since there's no POS/sales module — it's infrastructure for the next module to call.
- All endpoints require `SUPER_ADMIN` (reuses Module 2's `authenticate`/`authorize` middleware unchanged); warehouse and product modules untouched

## Module 6 — POS / Cash Register (DONE)

- Full cashier screen at `/pos`: search + category filter (server-side, debounced, paginated — no silent truncation as the catalog grows), product grid with photo/price cards, live cart with qty steppers, checkout
- `POST /api/sales` creates `Sale`+`SaleItem`s and deducts every item's recipe ingredients — Sale creation, SaleItem rows, and all stock deductions happen in ONE Prisma transaction (variant existence/active-state/price are all read fresh *inside* that transaction, not pre-fetched, to close a TOCTOU gap): any shortfall anywhere rolls back the entire sale, no partial sales
- DIRECT-sale products (drinks) use the exact same recipe-deduction mechanism as recipe-based products (a 1-line, qty-1 recipe pointing at the product's own stock ingredient) — no special-casing, no schema change
- `/api/recipes`' `consumeRecipeStock` was refactored (behavior-preserving) into a reusable `deductRecipeIngredients(tx, ...)` so Module 6 could compose it into its own transaction instead of duplicating the logic
- `/api/products` and `/api/categories` reads opened to `SELLER` (writes remain `SUPER_ADMIN`-only, gated per-route)
- Fully responsive: side-by-side desktop layout, mobile collapses the cart into a bottom bar that expands into a full-screen sheet
- Race-tested: concurrent checkouts competing for the last unit of stock — exactly one succeeds, the other gets a clean error, stock never goes negative or double-deducts

## Module 7 — Reports & Analytics (DONE)

- Dashboard: 6 stat cards (today/week/month revenue as fixed rolling-window reference cards; lifetime total revenue/receipt count/average receipt) — 4 parallel Prisma `aggregate` calls, zero rows fetched
- Date filter (Сегодня/Вчера/Неделя/Месяц/произвольный период) drives the sales list, its period summary strip, and Top Products — shared `resolveDateRange()` utility so every report means the same thing by "Неделя"
- Sales list: paginated, searchable by seller name, sale detail dialog (items/variants/qty/price/subtotal)
- Top-10 products by units sold — one `groupBy` + one `findMany`, no N+1
- Low-stock widget reuses Module 3's existing `useIngredients({lowStock:true})` — zero new backend code for it
- Two new indexes (`Sale(locationId, createdAt)`, `SaleItem(variantId)`) for the access patterns every report query uses
- `/api/reports/*` is `SUPER_ADMIN`-only; all other modules untouched

## Module 8 — Purchases (DONE)

- Supplier CRUD (name/phone/note) and purchase entry, both reusing the `Supplier`/`Purchase`/`PurchaseItem` tables already defined in Module 1's schema (unused until now)
- Recording a purchase adds every line's units to stock and updates the ingredient's `lastUnitCost`/`avgUnitCost` (a running weighted average across all locations) — Purchase + PurchaseItems + stock increments + a `StockReason.PURCHASE` movement per line, all in ONE transaction, same all-or-nothing shape as Module 6's Sale creation
- Ingredients are validated fresh *inside* the transaction (existence + active state) — same TOCTOU reasoning as Module 6's variant lookup
- Purchases list: date-filtered (shared `resolveDateRange`/`withDateRange`, relocated from Module 7's reports module to `shared/utils` so both modules use identical date-range semantics), searchable by supplier/note, filterable by supplier, paginated, detail dialog (per-line pack breakdown + computed unit cost)
- Two new indexes (`Purchase(locationId, purchaseDate)`, `PurchaseItem(ingredientId)`) for the access patterns this module's queries use
- `/api/purchases/*` and `/api/suppliers/*` are `SUPER_ADMIN`-only; all other modules untouched

## Module 9 — Profit & Cost Analytics (DONE)

- Two centralized primitives (`modules/reports/report.costing.ts`) are the only place cost/profit math lives: `getVariantCostMap` (cost per unit = Σ recipe.quantity × ingredient.avgUnitCost, one batched query per call site, never per-item) and `computeProfitStats` (revenue/cost/profit/margin for a date window). Every profit figure in the app — dashboard cards, the profit-summary endpoint, sale-detail cost/profit, product profitability — is computed by one of these two functions, not reimplemented per screen
- Cost uses ingredients' CURRENT `avgUnitCost` (per spec), not a value frozen at sale time — there's no cost snapshot on `SaleItem`, so historical profit shifts as later purchases move an ingredient's average cost; this is a deliberate characteristic, not a bug
- Dashboard (`/api/reports/dashboard`) gained profit alongside each existing revenue card (today/week/month/all-time); sale detail (`/api/reports/sales/:id`) gained per-item cost/profit + chek totals; a `hasCostData` flag distinguishes "no recipe configured" (cost genuinely unknown) from "recipe exists but ingredient never purchased" (cost is really 0) so the UI doesn't show a misleading 100% margin
- New: `/api/reports/profit` (arbitrary-period profit summary), `/api/reports/product-profitability` (sortable/paginated per-product revenue/cost/profit/margin), `/api/reports/ingredient-analytics` (consumption, cost of consumption, current stock, a simple days-remaining shortage forecast)
- Product/ingredient analytics sort in JS (profit/margin/consumption aren't SQL columns) but stay bounded by catalog size — a `groupBy` over `SaleItem`/`StockMovement`, never a per-row scan — so this stays fast regardless of transaction volume (load-tested at 400+ sales)
- `resolveDateRange`/`withDateRange` (`shared/utils/dateRange.ts`, already shared with Module 8) drive every new endpoint's period filtering
- All new endpoints inherit the existing `/api/reports` router-level `SUPER_ADMIN`-only gate; no other module touched

## Module 10 — System Settings (DONE, final functional module)

- Company settings (name, logo, phone, address, currency, timezone, tax %, receipt header/footer) persisted through Module 1's existing generic `Setting` key-value table — a fixed server-side whitelist of keys, not free-form, so the API can't be used to write arbitrary rows; logo upload reuses the exact `/uploads/image` endpoint Module 4 built for product photos (the upload helper was relocated from `entities/product` to `shared/lib/uploads.ts` since it was already generic, not product-specific — zero behavior change, existing product-photo call sites re-export the same functions under their old names)
- Full user CRUD (`/api/users`) — create/edit/role/login, admin-initiated password reset (revokes that user's sessions), delete-or-deactivate following the exact same "hard-delete, fall back to a 409 if referential history blocks it" pattern Module 4's `deleteProduct` established (a user who ever made a sale/purchase/movement can't be hard-deleted — `isActive` toggle is offered instead)
- Two safety guards unique to user management (not needed by any prior reference-CRUD module): an admin can't deactivate/demote/delete **themselves**, and can't deactivate/delete the **last active SUPER_ADMIN** — both verified live, including the realistic race the second guard actually protects against (a still-valid access token issued before the account was deactivated by someone else)
- Self-service password change (`POST /api/auth/change-password`, any authenticated role) added to the existing auth module — requires the current password (unlike the admin reset) and revokes the user's own existing refresh tokens the same way, so a compromised password can't keep an attacker's session alive after it's changed
- JWT lifetimes are surfaced read-only from `env.jwt` (already `.env`-configured since Module 2) — per the spec, not duplicated into the database, since that would be a second, conflicting source of truth for a value that's process-lifetime-fixed anyway
- System info (`/api/settings/system-info`): app/Node/Prisma/PostgreSQL versions plus live counts (users/products/sales/purchases/ingredients) — all read-only, computed on demand
- `/api/users/*` and `/api/settings/*` are `SUPER_ADMIN`-only; the one exception, self password-change, is intentionally open to any authenticated role

All 10 planned modules are complete.

## Getting started

See `server/README.md` and root instructions below.

### 1. Database
Create a PostgreSQL database, e.g.:
```
createdb champ_pos
```

### 2. Server
```
cd server
cp .env.example .env      # then edit DATABASE_URL, JWT_SECRET
npm install
npm run prisma:generate
npm run prisma:migrate     # creates tables (first migration)
npm run seed               # inserts admin, location, menu
npm run dev                # starts API on http://localhost:4000
```

### 3. Client
```
cd client
cp .env.example .env
npm install
npm run dev                # starts UI on http://localhost:5173
```

Health check: open http://localhost:4000/api/health

## Production deployment

The project ships ready to run 24/7 on a real VPS, either fully containerized or bare-metal:

```
champ-pos/
├── docker-compose.yml         # frontend + backend + PostgreSQL, one command
├── .env.example                # Postgres credentials / frontend port for docker-compose
├── server/Dockerfile            # multi-stage: build → migrate on start → run
├── client/Dockerfile            # multi-stage: vite build → nginx
├── client/nginx.conf            # SPA routing + /api, /uploads reverse proxy
├── deploy/
│   ├── nginx-host.conf          # host-level reverse proxy + Let's Encrypt (VPS)
│   ├── ecosystem.config.cjs     # PM2 process definition (non-Docker path)
│   ├── champ-pos-backend.service # systemd unit (non-Docker path, alternative to PM2)
│   └── postgresql.conf          # production-tuned Postgres settings
├── scripts/
│   ├── backup-db.sh              # timestamped pg_dump + retention pruning
│   └── restore-db.sh             # restore from a backup-db.sh output file
├── render.yaml                   # Render Blueprint — backend + frontend + Postgres, free tier
├── docs/RENDER_DEPLOY.md         # click-by-click guide for the free Render deploy above
└── docs/DEPLOYMENT.md            # full guide: VPS setup, domain, SSL, backups, updates,
                                    # new branches, new admins, PWA install (Android/iOS)
```

Quick start (Docker, VPS):
```
cp .env.example .env && cp server/.env.example server/.env   # edit secrets first
docker compose up -d --build
```

See `docs/DEPLOYMENT.md` for the complete VPS walkthrough, including the non-Docker
(PM2/systemd) path and everyday operations (backups, updates, adding a branch/admin).

**Free hosting instead of a VPS:** see `docs/RENDER_DEPLOY.md` — deploys backend, frontend,
and a PostgreSQL database on [Render](https://render.com)'s free plan straight from
`render.yaml` in this repo.
