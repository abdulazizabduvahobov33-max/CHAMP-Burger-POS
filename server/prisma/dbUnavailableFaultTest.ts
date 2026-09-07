/**
 * Fault injection: DB unreachable. Points DATABASE_URL at a closed local port BEFORE importing
 * anything else (config/env.ts / config/db.ts read it once, at import time) — a fresh process
 * for exactly that reason, same convention as authSecurityAudit.ts's authTimingCheck.ts child.
 * Confirms the running server:
 *   - never crashes the whole process from one request against a dead DB;
 *   - returns a sanitized 500 (no DATABASE_URL, no Prisma internals, no stack trace);
 *   - keeps answering requests afterward (proving one bad query doesn't wedge the process).
 *
 * Local only — never touches a real database, on purpose (that's the whole point: there isn't
 * one to touch here).
 *
 * Run from server/:  npx tsx prisma/dbUnavailableFaultTest.ts
 */
// Sanitized error responses are a NODE_ENV=production behavior by design (see
// middleware/error.ts) — dev mode intentionally shows the real error for local debugging, which
// is correct and not a leak (it's a local developer's own terminal, not a customer response).
// Render sets NODE_ENV=production for real, so that's the mode this fault test actually needs to
// exercise to mean anything about the deployed app.
process.env.NODE_ENV = "production";
process.env.DATABASE_URL = "postgresql://faultinject:faultinject@127.0.0.1:1/does_not_matter";

import request from "supertest";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail?: string) {
  console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
  ok ? pass++ : fail++;
}

async function main() {
  const { createApp } = await import("../src/app.js");
  const agent = request(createApp());

  const health = await agent.get("/api/health").timeout(15000);
  check("health check survives a dead DB (no crash, still answers)", health.status === 200, `status ${health.status}`);
  check("health check body honestly reports db:\"down\", not a fake \"ok\"", health.body?.db === "down", JSON.stringify(health.body));

  const loginAttempt = await agent.post("/api/auth/login").send({ login: "whoever", password: "whatever" }).timeout(15000);
  check("a request that needs the DB fails safely (5xx or a clean 401, never hangs/crashes)", loginAttempt.status >= 400, `status ${loginAttempt.status}`);

  const bodyText = JSON.stringify(loginAttempt.body);
  check("error response never contains the DB host/user/password", !bodyText.includes("127.0.0.1") && !bodyText.includes("faultinject"));
  check("error response never contains a stack trace", !bodyText.includes(".ts:") && !/\bat \S+\(/.test(bodyText));
  check("error response never contains a raw Prisma error class name", !bodyText.includes("PrismaClient") && !bodyText.includes("PostgresError"));

  // Process is still alive and answering — the whole point: one request against a dead DB must
  // not have taken the entire server down for every OTHER request.
  const secondRequest = await agent.get("/api/health").timeout(15000);
  check("the process is still alive and answering after the failed request (no crash)", secondRequest.status === 200);

  console.log(`\n${pass}/${pass + fail} checks PASS`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("DB-unavailable fault test failed:", err);
  process.exitCode = 1;
});
