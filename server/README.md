# KRUNCH POS — Server (Module 1)

Node.js + Express + TypeScript + Prisma + PostgreSQL.

## Setup

```bash
cp .env.example .env          # edit DATABASE_URL, JWT secrets, admin creds
npm install
npm run prisma:generate       # generate Prisma client
npm run prisma:migrate        # create tables (first migration "init")
npm run seed                  # insert admin, location, settings, menu
npm run dev                   # start API — http://localhost:4000
```

Health check: `GET http://localhost:4000/api/health`

## Scripts

| Script                | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `npm run dev`         | Start API in watch mode (tsx)            |
| `npm run build`       | Compile TypeScript to `dist/`            |
| `npm start`           | Run compiled server                      |
| `npm run prisma:generate` | Generate Prisma client               |
| `npm run prisma:migrate`  | Run/create migrations (dev)          |
| `npm run prisma:studio`   | Open Prisma Studio (DB browser)      |
| `npm run seed`        | Seed baseline data                       |

## What Module 1 delivers

- Express app with security middleware (helmet, cors, rate-limit), JSON body
  parsing, request logging, cookie parsing.
- `GET /api/health` — reports service + DB connectivity.
- Central error handler with a single `{ error: { code, message } }` format.
- Prisma schema covering the full architecture (MVP + future-ready tables,
  multi-location fields).
- Seed: main location, super admin, default settings, full menu with variants.

Later modules mount their routes in `src/app.ts` and add folders under
`src/modules/`.

## Default admin

Login and password come from `.env` (`SEED_ADMIN_LOGIN`, `SEED_ADMIN_PASSWORD`).
Defaults: `admin` / `admin123` — **change before production.**
