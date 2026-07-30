# ── Stage 1: build the static production bundle ─────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# VITE_API_URL defaults to "/api" (see .env.example) — a relative path works because nginx
# below proxies /api to the backend on the SAME origin, so no build-time API URL injection
# is needed for the standard same-domain deployment this compose file sets up.
RUN npm run build

# ── Stage 2: serve the build with nginx ─────────────────────────────────
FROM nginx:1.27-alpine AS production
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:80/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
