/**
 * Recovery drill — boots the REAL backend app against the RESTORED drill database
 * (champ_pos_restore_drill, an isolated local copy restored from a real production backup —
 * never production itself) and runs real HTTP requests: health, login, menu, reports, warehouse.
 * Sets a KNOWN test password for the restored "admin" user IN THE DRILL DB ONLY (a separate,
 * local, disposable database — never touches real production credentials) so login can actually
 * be exercised end-to-end.
 *
 * Run from server/:  npx tsx prisma/recoveryDrillSmoke.ts
 */
import dotenv from "dotenv";

dotenv.config();
// Redirect DATABASE_URL to the isolated drill DB BEFORE anything else (config/db.ts /
// config/env.ts) reads it — dotenv.config() never overwrites an already-set process.env value,
// so this must run right after loading .env and before any other import.
process.env.DATABASE_URL = process.env.DATABASE_URL?.replace(/\/[a-zA-Z0-9_]+(\?|$)/, "/champ_pos_restore_drill$1");

import bcrypt from "bcrypt";
import request from "supertest";
import { PrismaClient } from "@prisma/client";

const DRILL_PASSWORD = "DrillTest123!";

async function main() {
  console.log(`Target DB (drill only): ${process.env.DATABASE_URL?.replace(/:\/\/[^@]+@/, "://***@")}`);

  const prisma = new PrismaClient();
  const passwordHash = await bcrypt.hash(DRILL_PASSWORD, 10);
  await prisma.user.update({ where: { login: "admin" }, data: { passwordHash } });
  console.log('Set a known test password for the restored "admin" user — in the DRILL DB only.');
  await prisma.$disconnect();

  const { createApp } = await import("../src/app.js");
  const agent = request(createApp());

  let pass = 0;
  let fail = 0;
  function check(name: string, ok: boolean, detail?: string) {
    console.log(`${ok ? "PASS" : "FAIL"} — ${name}${detail ? ` (${detail})` : ""}`);
    ok ? pass++ : fail++;
  }

  const health = await agent.get("/api/health");
  check("health check against restored DB", health.status === 200 && health.body.db === "up", JSON.stringify(health.body));

  const login = await agent.post("/api/auth/login").send({ login: "admin", password: DRILL_PASSWORD });
  check("login with the restored admin account (known drill password)", login.status === 200 && !!login.body.accessToken);
  const token = login.body.accessToken as string;
  const bearer = { Authorization: `Bearer ${token}` };

  const me = await agent.get("/api/auth/me").set(bearer);
  check("session check (/auth/me) after login", me.status === 200 && me.body.user?.login === "admin");

  const products = await agent.get("/api/products?page=1&pageSize=20").set(bearer);
  check("menu/products read from restored data", products.status === 200 && Array.isArray(products.body.items) && products.body.items.length > 0, `${products.body.items?.length ?? 0} products`);

  const dashboard = await agent.get("/api/reports/dashboard").set(bearer);
  check("reports dashboard read from restored data", dashboard.status === 200 && typeof dashboard.body.receiptCount === "number", `receiptCount=${dashboard.body.receiptCount}`);

  const salesList = await agent.get("/api/reports/sales?preset=month&page=1&pageSize=20").set(bearer);
  check("reports sales list read from restored data", salesList.status === 200 && Array.isArray(salesList.body.items));

  const ingredients = await agent.get("/api/ingredients?page=1&pageSize=20").set(bearer);
  check("warehouse/ingredients read from restored data", ingredients.status === 200 && Array.isArray(ingredients.body.items) && ingredients.body.items.length > 0, `${ingredients.body.items?.length ?? 0} ingredients`);

  console.log(`\n${pass}/${pass + fail} recovery-drill smoke checks PASS`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error("Recovery drill smoke test failed:", err);
  process.exitCode = 1;
});
