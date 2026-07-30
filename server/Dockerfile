# ── Stage 1: install deps, generate Prisma client, compile TypeScript ──
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Stage 2: production image ───────────────────────────────────────────
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Prisma's query engine needs OpenSSL on Alpine (musl libc ships without it by default).
RUN apk add --no-cache openssl

# Full node_modules (not just prod deps) is copied on purpose: the Prisma CLI
# (a devDependency) is what `docker-entrypoint.sh` uses to run `prisma migrate deploy`
# on every container start, so the image needs it at runtime, not just at build time.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package.json ./

# UPLOADS_DIR resolves to `<cwd>/src/uploads` (see src/shared/utils/uploads.ts) — cwd here
# is /app, so this is where product-photo/logo uploads persist. Mount a volume over it
# in docker-compose.yml so uploads survive container recreation.
RUN mkdir -p src/uploads

COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health | grep -q '"status":"ok"' || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
