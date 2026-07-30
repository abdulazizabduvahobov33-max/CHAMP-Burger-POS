import dotenv from "dotenv";

dotenv.config();

/**
 * Centralised, validated access to environment variables.
 * Fails fast on startup if something critical is missing.
 */
function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

const clientUrlRaw = optional("CLIENT_URL", "http://localhost:5173");

export const env = {
  nodeEnv: optional("NODE_ENV", "development"),
  port: Number(optional("PORT", "4000")),
  // Kept for any existing call sites that want "the" client URL (e.g. logging).
  clientUrl: clientUrlRaw,
  // CORS needs the full list: production commonly serves both an apex and a www domain
  // (or a staging + prod pair) from one backend. Comma-separated in .env, trimmed here.
  clientUrls: clientUrlRaw.split(",").map((u) => u.trim()).filter(Boolean),
  databaseUrl: required("DATABASE_URL"),

  // Auth secrets — required, not defaulted: a silent fallback here would mean a
  // misconfigured deployment starts up signing tokens with a guessable, publicly-documented
  // secret (this file), allowing full authentication bypass. `.env.example` already ships
  // real placeholder values, so every documented setup path already sets these.
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessExpires: optional("JWT_ACCESS_EXPIRES", "15m"),
    refreshExpires: optional("JWT_REFRESH_EXPIRES", "7d"),
  },

  isProd: optional("NODE_ENV", "development") === "production",

  // Off by default: trusting X-Forwarded-For when the app is NOT actually behind a reverse
  // proxy lets any direct client spoof that header to get a fresh rate-limit bucket per
  // request. Only set TRUST_PROXY=true when a real proxy (nginx, load balancer, ...) sits
  // in front of this server and overwrites that header itself.
  trustProxy: optional("TRUST_PROXY", "false") === "true",

  // AI Assistant module (modules/ai) — "local" (default, free, no external calls) is the only
  // implemented provider today. Set AI_PROVIDER=openai or AI_PROVIDER=claude once the matching
  // provider is implemented in modules/ai/providers and an API key is supplied below; the
  // provider factory (providers/index.ts) falls back to "local" for any unrecognised value, so
  // this never needs a code change just to keep the app running without a key configured.
  ai: {
    provider: optional("AI_PROVIDER", "local"),
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  },
} as const;
