/**
 * Empirically proves (or disproves) the timezone/date-boundary concern flagged in
 * dateRange.ts's own comment: "today" is computed from the SERVER PROCESS's local timezone,
 * with no per-business setting. This creates one TEST DB fixture sale near a UTC/Asia-Tashkent
 * midnight boundary, then re-runs resolveDateRange("today") in two separate child processes —
 * one with TZ=UTC, one with TZ=Asia/Tashkent — to see whether the SAME real sale lands in a
 * different calendar day purely because of the server's TZ setting.
 *
 * Run from server/:  npx tsx prisma/timezoneAudit.ts
 */
import { execSync } from "node:child_process";

import { PrismaClient, Prisma } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

const prisma = new PrismaClient();

async function childMode(saleId?: string) {
  const { resolveDateRange } = await import("../src/shared/utils/dateRange.js");
  const range = resolveDateRange("today");
  let included: boolean | null = null;
  if (saleId) {
    const sale = await prisma.sale.findUnique({ where: { id: saleId } });
    included = sale ? sale.createdAt.getTime() >= range.start.getTime() && sale.createdAt.getTime() <= range.end.getTime() : null;
  }
  console.log(`RESULT ${JSON.stringify({ tz: process.env.TZ ?? "(unset)", start: range.start.toISOString(), end: range.end.toISOString(), included })}`);
  await prisma.$disconnect();
}

function runChild(tz: string, saleId?: string) {
  // saleId always comes from our own just-created Prisma cuid, never external input — safe to
  // interpolate into a shell command string (needed on Windows: spawning npx/npx.cmd without a
  // shell fails with ENOENT/EINVAL for both variants).
  const cmd = `npx tsx prisma/timezoneAudit.ts --child${saleId ? ` ${saleId}` : ""}`;
  const output = execSync(cmd, { env: { ...process.env, TZ: tz }, encoding: "utf-8" });
  const line = output.split("\n").find((l) => l.startsWith("RESULT "));
  if (!line) throw new Error(`child produced no RESULT line, full output:\n${output}`);
  return JSON.parse(line.slice("RESULT ".length));
}

async function main() {
  const admin = await prisma.user.findUniqueOrThrow({ where: { login: process.env.SEED_ADMIN_LOGIN || "admin" } });
  const location = await prisma.location.findFirstOrThrow();

  const utcProbe = runChild("UTC");
  const utcStart = new Date(utcProbe.start);

  // 1 hour before UTC's "today" window starts (23:00 UTC "yesterday"). In Asia/Tashkent
  // (UTC+5) that instant is 04:00 local — early this morning from the business's point of view.
  const fixtureCreatedAt = new Date(utcStart.getTime() - 60 * 60 * 1000);

  const sale = await prisma.sale.create({
    data: {
      sellerId: admin.id,
      locationId: location.id,
      totalAmount: new Prisma.Decimal(1000),
      status: "ACCEPTED",
      createdAt: fixtureCreatedAt,
      acceptedAt: fixtureCreatedAt,
    },
  });

  try {
    console.log(`Fixture sale ${sale.id}: createdAt=${fixtureCreatedAt.toISOString()} UTC = 04:00 local in Asia/Tashkent, 1h before UTC midnight.`);

    const utcResult = runChild("UTC", sale.id);
    const tashkentResult = runChild("Asia/Tashkent", sale.id);

    console.log(`Server TZ=UTC:            "today" window ${utcResult.start} .. ${utcResult.end} | fixture counted as today? ${utcResult.included}`);
    console.log(`Server TZ=Asia/Tashkent:  "today" window ${tashkentResult.start} .. ${tashkentResult.end} | fixture counted as today? ${tashkentResult.included}`);

    if (utcResult.included !== tashkentResult.included) {
      console.log(
        "CONFIRMED: the exact same sale (same createdAt instant) is bucketed into a DIFFERENT report day purely depending on the server process's TZ. " +
          "There is no render.yaml in this repo (Render service config is entirely dashboard-managed, which this audit cannot inspect) and no TZ env var " +
          "is set anywhere in the codebase — Render's documented platform default for containers with no TZ override is UTC. If that holds for the deployed " +
          "backend, a Tashkent order placed roughly between 00:00 and 05:00 local time will show up under 'Вчера' instead of 'Сегодня', and similarly skew " +
          "week/month/custom-range boundaries by the same ~5 hours. This is inference from repo config + Render's documented default, not a confirmed read " +
          "of the actual deployed environment (no dashboard access) — MANUAL CHECK NEEDED to confirm the real TZ env var on the Render service.",
      );
    } else {
      console.log("UNEXPECTED: no difference observed — investigate before trusting this finding.");
    }
  } finally {
    await prisma.sale.delete({ where: { id: sale.id } });
  }
}

const isChild = process.argv[2] === "--child";
(isChild ? childMode(process.argv[3]) : main())
  .catch((err) => {
    console.error("Timezone audit failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (!isChild) await prisma.$disconnect();
  });
