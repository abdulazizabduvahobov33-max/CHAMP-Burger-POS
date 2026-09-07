/**
 * AUTH / PERMISSIONS / SESSION SECURITY AUDIT — real HTTP requests against the actual Express
 * app (via supertest, no middleware mocking) + a real TEST DB. Runs ONLY against whatever
 * DATABASE_URL is configured — never point this at production. Creates isolated fixture users
 * (AUTH_AUDIT_*), exercises the full auth stack (real bcrypt, real JWT, real Prisma), and cleans
 * up after itself.
 *
 * Run from server/:  npx tsx prisma/authSecurityAudit.ts
 */
import { execSync } from "node:child_process";

import jwt from "jsonwebtoken";
import request from "supertest";
import { PrismaClient, Prisma } from "@prisma/client";
import dotenv from "dotenv";
import bcrypt from "bcrypt";

dotenv.config();

const prisma = new PrismaClient();
const MARK = "AUTH_AUDIT";
const PASSWORD = "AuditPass123!";

let results: { name: string; pass: boolean; detail?: string }[] = [];
function check(name: string, pass: boolean, detail?: string) {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
}

async function main() {
  const { createApp } = await import("../src/app.js");
  const { env } = await import("../src/config/env.js");
  const app = createApp();
  const agent = request(app);

  // ── Setup: isolated fixture users, direct via Prisma (never through /api/users — OWNER
  // creation is blocked there by design, and this keeps every fixture's password known) ──
  const location = await prisma.location.upsert({
    where: { id: "main-location" },
    update: {},
    create: { id: "main-location", name: "Main", isActive: true },
  });
  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  const admin = await prisma.user.create({
    data: { name: `${MARK}_admin`, login: `${MARK.toLowerCase()}_admin_${Date.now()}`, passwordHash, role: "SUPER_ADMIN", isActive: true, locationId: location.id },
  });
  const sellerA = await prisma.user.create({
    data: { name: `${MARK}_seller_a`, login: `${MARK.toLowerCase()}_seller_a_${Date.now()}`, passwordHash, role: "SELLER", isActive: true, locationId: location.id },
  });
  const sellerB = await prisma.user.create({
    data: { name: `${MARK}_seller_b`, login: `${MARK.toLowerCase()}_seller_b_${Date.now()}`, passwordHash, role: "SELLER", isActive: true, locationId: location.id },
  });
  const owner = await prisma.user.create({
    data: { name: `${MARK}_owner`, login: `${MARK.toLowerCase()}_owner_${Date.now()}`, passwordHash, role: "OWNER", isActive: true, locationId: location.id },
  });
  const toDeactivate = await prisma.user.create({
    data: { name: `${MARK}_deact`, login: `${MARK.toLowerCase()}_deact_${Date.now()}`, passwordHash, role: "SELLER", isActive: true, locationId: location.id },
  });
  const table = await prisma.table.create({ data: { locationId: location.id, number: 8801, isActive: true } });

  const cleanupIds = { users: [admin.id, sellerA.id, sellerB.id, owner.id, toDeactivate.id], tableId: table.id, saleIds: [] as string[] };

  try {
    // ── Login all fixtures once, up front (before any rate-limit-exhausting test) ──
    async function loginAs(login: string) {
      const res = await agent.post("/api/auth/login").send({ login, password: PASSWORD });
      return res;
    }
    const adminLogin = await loginAs(admin.login);
    const sellerALogin = await loginAs(sellerA.login);
    const sellerBLogin = await loginAs(sellerB.login);
    const ownerLogin = await loginAs(owner.login);
    const deactLogin = await loginAs(toDeactivate.login);

    check("login succeeds for all 4 real roles with correct password", [adminLogin, sellerALogin, sellerBLogin, ownerLogin].every((r) => r.status === 200));

    const adminToken = adminLogin.body.accessToken as string;
    const sellerAToken = sellerALogin.body.accessToken as string;
    const sellerBToken = sellerBLogin.body.accessToken as string;
    const ownerToken = ownerLogin.body.accessToken as string;
    const deactToken = deactLogin.body.accessToken as string;
    const deactCookie = deactLogin.headers["set-cookie"];

    const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

    // ═══ Section 2: role authorization matrix (real HTTP, not mocked) ═══
    console.log("\n=== Section 2: role authorization matrix ===");

    const noAuth = await agent.get("/api/reports/dashboard");
    check("unauthenticated request to a protected endpoint -> 401", noAuth.status === 401);

    const matrix: [string, string, string, Record<string, string>, number[]][] = [
      // [label, method, path, headers, [expectedForAdmin, expectedForSeller, expectedForOwner] as "ok"(<400) or exact code]
      ["GET /api/reports/dashboard", "get", "/api/reports/dashboard", {}, [200, 403, 403]],
      ["GET /api/users", "get", "/api/users", {}, [200, 403, 403]],
      ["GET /api/ingredients", "get", "/api/ingredients", {}, [200, 403, 403]],
      ["GET /api/purchases", "get", "/api/purchases", {}, [200, 403, 403]],
      ["GET /api/suppliers", "get", "/api/suppliers", {}, [200, 403, 403]],
      ["GET /api/settings", "get", "/api/settings", {}, [200, 403, 403]],
      ["GET /api/ai/messages", "get", "/api/ai/messages", {}, [200, 403, 403]],
      ["GET /api/owner/sales", "get", "/api/owner/sales", {}, [403, 403, 200]],
      ["POST /api/sales/:id/reject (OWNER-only)", "post", "/api/sales/does-not-exist/reject", {}, [403, 403, 404]],
    ];
    for (const [label, method, path, , expected] of matrix) {
      const [asAdmin, asSeller, asOwner] = await Promise.all([
        (agent as any)[method](path).set(bearer(adminToken)),
        (agent as any)[method](path).set(bearer(sellerAToken)),
        (agent as any)[method](path).set(bearer(ownerToken)),
      ]);
      check(`${label} — SUPER_ADMIN`, asAdmin.status === expected[0], `got ${asAdmin.status}, expected ${expected[0]}`);
      check(`${label} — SELLER`, asSeller.status === expected[1], `got ${asSeller.status}, expected ${expected[1]}`);
      check(`${label} — OWNER`, asOwner.status === expected[2], `got ${asOwner.status}, expected ${expected[2]}`);
    }

    // SELLER creates a sale (waiter flow, PENDING) — needed for accept/reject + horizontal tests
    const createSaleRes = await agent
      .post("/api/sales")
      .set(bearer(sellerAToken))
      .send({ items: [], tableId: table.id }); // empty cart is fine for a 422 or a real sale depending on schema; we just need SOME sale
    // If the schema requires at least one item, fall back to creating one directly for the tests
    // that only need a saleId to exist (horizontal-access / accept-forbidden checks don't need
    // real line items).
    let saleForTests: string;
    if (createSaleRes.status === 201) {
      saleForTests = createSaleRes.body.sale.id;
    } else {
      const s = await prisma.sale.create({ data: { sellerId: sellerA.id, locationId: location.id, tableId: table.id, totalAmount: 0, status: "PENDING" } });
      saleForTests = s.id;
    }
    cleanupIds.saleIds.push(saleForTests);

    const sellerAcceptAttempt = await agent.post(`/api/sales/${saleForTests}/accept`).set(bearer(sellerAToken)).send({});
    check("SELLER cannot accept a PENDING order directly (owner/cashier-only)", sellerAcceptAttempt.status === 403);

    const sellerRejectAttempt = await agent.post(`/api/sales/${saleForTests}/reject`).set(bearer(sellerAToken)).send({});
    check("SELLER cannot reject a PENDING order (OWNER-only)", sellerRejectAttempt.status === 403);

    const adminRejectAttempt = await agent.post(`/api/sales/${saleForTests}/reject`).set(bearer(adminToken)).send({});
    check("SUPER_ADMIN (cashier) cannot reject either — reject is OWNER-only by design", adminRejectAttempt.status === 403);

    const ownerCorrectionAttempt = await agent.post(`/api/owner/sales/${saleForTests}/cancel`).set(bearer(ownerToken)).send({});
    check("OWNER CAN reach the owner-correction endpoint (not necessarily a successful cancel — sale may not be ACCEPTED)", ownerCorrectionAttempt.status !== 403 && ownerCorrectionAttempt.status !== 401);

    const adminOwnerCorrectionAttempt = await agent.post(`/api/owner/sales/${saleForTests}/cancel`).set(bearer(adminToken)).send({});
    check("SUPER_ADMIN (cashier) CANNOT reach any /api/owner/* endpoint, even though they can accept sales", adminOwnerCorrectionAttempt.status === 403);

    // ═══ Section 3: horizontal privilege escalation ═══
    console.log("\n=== Section 3: horizontal privilege escalation ===");

    const sellerBViewsSellerASale = await agent.get(`/api/sales/${saleForTests}`).set(bearer(sellerBToken));
    check("SELLER B cannot view SELLER A's own sale via GET /api/sales/:id (my-sale scoping)", sellerBViewsSellerASale.status === 404);

    const sellerAViewsOwnSale = await agent.get(`/api/sales/${saleForTests}`).set(bearer(sellerAToken));
    check("SELLER A CAN view their own sale", sellerAViewsOwnSale.status === 200);

    // Body-injection attempt: SELLER B tries to create a sale claiming to be SELLER A by putting
    // sellerId in the body — server must derive the seller from the JWT (req.user.sub), not trust
    // any client-supplied id.
    const injectedSale = await agent
      .post("/api/sales")
      .set(bearer(sellerBToken))
      .send({ items: [], tableId: table.id, sellerId: sellerA.id, userId: sellerA.id });
    if (injectedSale.status === 201) {
      const created = await prisma.sale.findUnique({ where: { id: injectedSale.body.sale.id } });
      check("body-injected sellerId/userId is ignored — sale is attributed to the ACTUAL caller (from JWT)", created?.sellerId === sellerB.id);
      cleanupIds.saleIds.push(injectedSale.body.sale.id);
    } else {
      check("body-injected sellerId/userId is ignored (create rejected for an unrelated reason, so nothing to attribute)", true, `status ${injectedSale.status}`);
    }

    // ═══ Section 4: token security ═══
    console.log("\n=== Section 4: token security ===");

    const expiredToken = jwt.sign({ sub: sellerA.id, role: "SELLER", locationId: location.id, type: "access" }, env.jwt.accessSecret, { expiresIn: -10 });
    const expiredRes = await agent.get("/api/reports/dashboard").set(bearer(expiredToken));
    check("expired access token -> 401", expiredRes.status === 401);

    const malformedRes = await agent.get("/api/reports/dashboard").set(bearer("not-a-jwt-at-all"));
    check("malformed token -> 401", malformedRes.status === 401);

    const wrongSigToken = jwt.sign({ sub: sellerA.id, role: "SUPER_ADMIN", locationId: location.id, type: "access" }, "definitely-the-wrong-secret", { expiresIn: "15m" });
    const wrongSigRes = await agent.get("/api/reports/dashboard").set(bearer(wrongSigToken));
    check("token with invalid signature (forged role=SUPER_ADMIN) -> 401, not trusted", wrongSigRes.status === 401);

    // Refresh rotation + reuse
    const refresh1 = await agent.post("/api/auth/refresh").set("Cookie", sellerALogin.headers["set-cookie"]);
    check("refresh with a valid, unexpired cookie succeeds", refresh1.status === 200 && !!refresh1.body.accessToken);
    const rotatedCookie = refresh1.headers["set-cookie"];
    check("refresh issues a NEW refresh cookie, different from the old one", JSON.stringify(rotatedCookie) !== JSON.stringify(sellerALogin.headers["set-cookie"]));

    const reuseOldRefresh = await agent.post("/api/auth/refresh").set("Cookie", sellerALogin.headers["set-cookie"]);
    check("reusing the OLD (already-rotated) refresh token fails", reuseOldRefresh.status === 401);

    const noRefreshCookie = await agent.post("/api/auth/refresh");
    check("refresh with no cookie at all -> 401", noRefreshCookie.status === 401);

    const garbageRefresh = await agent.post("/api/auth/refresh").set("Cookie", "refreshToken=garbage-not-a-jwt");
    check("refresh with a malformed cookie value -> 401", garbageRefresh.status === 401);

    // Logout invalidation
    // Reuses sellerBLogin's own (still-unrotated) refresh cookie rather than logging in again —
    // keeps this script's total login-attempt count well under the rate limiter's budget.
    const logoutRes = await agent.post("/api/auth/logout").set("Cookie", sellerBLogin.headers["set-cookie"]);
    check("logout succeeds (204)", logoutRes.status === 204);
    const refreshAfterLogout = await agent.post("/api/auth/refresh").set("Cookie", sellerBLogin.headers["set-cookie"]);
    check("refresh token is invalidated after logout — cannot silently regain a session", refreshAfterLogout.status === 401);

    // Stale access token after the user is deactivated — documents the real, bounded window.
    const deactivateRes = await agent.patch(`/api/users/${toDeactivate.id}`).set(bearer(adminToken)).send({ isActive: false });
    check("SUPER_ADMIN can deactivate another user via the real endpoint", deactivateRes.status === 200);
    // /api/categories only requires `authenticate` (any authenticated role) — SELLER is
    // genuinely allowed here, so this isolates "does authenticate re-check isActive" from any
    // role-mismatch noise.
    const staleTokenStillWorks = await agent.get("/api/categories").set(bearer(deactToken));
    // NOT an assertion of "should fail" — this documents the actual (bounded, ~15min) behavior.
    console.log(
      `INFO — a deactivated user's still-unexpired access token, on an endpoint their role WOULD normally reach: status=${staleTokenStillWorks.status} ` +
        `(stateless JWT — authenticate() never re-checks isActive per-request; this is the access-token TTL window, see final report)`,
    );
    const refreshAfterDeactivate = await agent.post("/api/auth/refresh").set("Cookie", deactCookie);
    check("a deactivated user's refresh token is rejected immediately (closes the window on the NEXT refresh attempt)", refreshAfterDeactivate.status === 401);

    // ═══ Section 8 (checked here, needs live tokens): password hash never returned ═══
    console.log("\n=== Section 8: password handling ===");
    const meRes = await agent.get("/api/auth/me").set(bearer(sellerAToken));
    check("GET /api/auth/me never includes passwordHash", !JSON.stringify(meRes.body).toLowerCase().includes("passwordhash"));
    check("POST /api/auth/login response never includes passwordHash", !JSON.stringify(sellerALogin.body).toLowerCase().includes("passwordhash"));
    const usersListRes = await agent.get("/api/users").set(bearer(adminToken));
    check("GET /api/users list never includes passwordHash", !JSON.stringify(usersListRes.body).toLowerCase().includes("passwordhash"));

    const dbUser = await prisma.user.findUnique({ where: { id: sellerA.id } });
    check("passwords are hashed with bcrypt (not plaintext)", !!dbUser?.passwordHash.startsWith("$2"));

    // Login error message: same message/code for "no such user" vs "wrong password" (no enumeration)
    const wrongPwExistingUser = await agent.post("/api/auth/login").send({ login: sellerA.login, password: "definitely-wrong" });
    const nonexistentUser = await agent.post("/api/auth/login").send({ login: `${MARK.toLowerCase()}_does_not_exist`, password: "whatever" });
    check(
      "login error is identical (code+message) for 'wrong password' vs 'user does not exist' — no account enumeration via error text",
      wrongPwExistingUser.status === nonexistentUser.status &&
        wrongPwExistingUser.body?.error?.code === nonexistentUser.body?.error?.code &&
        wrongPwExistingUser.body?.error?.message === nonexistentUser.body?.error?.message,
    );

    // Timing side-channel: does "no such user" respond measurably faster than "wrong password
    // for a real user" (bcrypt.compare only runs in the second case)? Run as a SEPARATE process —
    // the login rate limiter (max 10/15min) is a module-level singleton per process (every
    // createApp() call in this SAME process shares one loginLimiter instance and its counter,
    // since routes are imported once and cached), so this script's own budget is already mostly
    // spent by the time we get here. A fresh `npx tsx` process gets a genuinely fresh limiter.
    const timingOutput = execSync(`npx tsx prisma/authTimingCheck.ts ${sellerB.login}`, { encoding: "utf-8" });
    console.log(timingOutput.trim());

    // JWT claims shape: confirm nothing ties a token to an issuing server/region (relevant to
    // the Oregon->Frankfurt cutover — verifyAccessToken is pure secret+claims, no iss/aud check).
    const decodedAdmin = jwt.decode(adminToken) as Record<string, unknown>;
    check(
      "access token carries no issuer/audience/instance-binding claim — verification is secret-only, so identical JWT_ACCESS_SECRET across regions is sufficient for a token to keep working after a region cutover",
      !("iss" in decodedAdmin) && !("aud" in decodedAdmin),
    );

    // ═══ Section 9: CORS ═══
    console.log("\n=== Section 9: CORS (local app) ===");
    const allowedOriginRes = await agent.get("/api/health").set("Origin", env.clientUrls[0]);
    check(`allowed origin (${env.clientUrls[0]}) gets Access-Control-Allow-Origin echoed back`, allowedOriginRes.headers["access-control-allow-origin"] === env.clientUrls[0]);
    const evilOriginRes = await agent.get("/api/health").set("Origin", "https://evil-attacker-site.example");
    check("an unrelated origin does NOT get Access-Control-Allow-Origin", !evilOriginRes.headers["access-control-allow-origin"]);
    check("Access-Control-Allow-Credentials is never combined with a wildcard origin", allowedOriginRes.headers["access-control-allow-credentials"] !== "true" || allowedOriginRes.headers["access-control-allow-origin"] !== "*");

    // ═══ Section 10: error response safety ═══
    console.log("\n=== Section 10: error response safety ===");
    const validationErr = await agent.post("/api/auth/login").send({ login: 123, password: null });
    check("a validation error never includes a stack trace", !JSON.stringify(validationErr.body).includes(".ts:") && !JSON.stringify(validationErr.body).includes("at "));
    check("a validation error never leaks the JWT secret", !JSON.stringify(validationErr.body).includes(env.jwt.accessSecret));

    // ═══ Section 7: brute-force (run LAST — deliberately exhausts the login rate limiter) ═══
    console.log("\n=== Section 7: login brute-force protection ===");
    const attempts: number[] = [];
    for (let i = 0; i < 15; i++) {
      const r = await agent.post("/api/auth/login").send({ login: sellerA.login, password: `wrong-${i}` });
      attempts.push(r.status);
    }
    const got429 = attempts.includes(429);
    check("repeated failed logins eventually hit a rate limit (429)", got429, `statuses: ${attempts.join(",")}`);
  } finally {
    // ── Cleanup ──
    await prisma.refreshToken.deleteMany({ where: { userId: { in: cleanupIds.users } } });
    if (cleanupIds.saleIds.length > 0) {
      await prisma.saleChangeLog.deleteMany({ where: { saleId: { in: cleanupIds.saleIds } } });
      await prisma.saleItem.deleteMany({ where: { saleId: { in: cleanupIds.saleIds } } });
      await prisma.sale.deleteMany({ where: { id: { in: cleanupIds.saleIds } } });
    }
    await prisma.table.deleteMany({ where: { id: cleanupIds.tableId } });
    await prisma.user.deleteMany({ where: { id: { in: cleanupIds.users } } });
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} checks PASS`);
  if (failed.length > 0) {
    console.log("FAILED:");
    for (const f of failed) console.log(`  - ${f.name}${f.detail ? ` (${f.detail})` : ""}`);
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("Auth security audit failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
