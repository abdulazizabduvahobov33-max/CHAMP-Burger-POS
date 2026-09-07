/**
 * Regression check for the timezone/date-boundary fix in dateRange.ts. resolveDateRange() now
 * computes every boundary explicitly in Asia/Tashkent (via Intl, not process.env.TZ) — this
 * creates a TEST DB fixture sale at 02:00 Tashkent-local time (early morning, the exact window
 * that used to be misbucketed into "yesterday" when the server ran in UTC) and confirms it is
 * correctly counted as "today" regardless of which timezone the RUNNING PROCESS itself is in.
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

  // Ask a UTC-run child for today's REAL Tashkent-anchored window, then place the fixture 2h
  // after its start — 02:00 Tashkent-local, squarely in the "00:00-05:00 local" window that used
  // to be misbucketed as "yesterday" before this fix, when the server ran in UTC.
  const probe = runChild("UTC");
  const fixtureCreatedAt = new Date(new Date(probe.start).getTime() + 2 * 60 * 60 * 1000);

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
    console.log(`Fixture sale ${sale.id}: createdAt=${fixtureCreatedAt.toISOString()} UTC (02:00 Tashkent-local, today).`);

    const results = {
      UTC: runChild("UTC", sale.id),
      "Asia/Tashkent": runChild("Asia/Tashkent", sale.id),
      "America/New_York": runChild("America/New_York", sale.id),
    };
    for (const [tz, r] of Object.entries(results)) {
      console.log(`Server TZ=${tz}: "today" window ${r.start} .. ${r.end} | fixture counted as today? ${r.included}`);
    }

    const allIncluded = Object.values(results).every((r) => r.included === true);
    const allIdenticalWindow = Object.values(results).every((r) => r.start === results.UTC.start && r.end === results.UTC.end);

    if (allIncluded && allIdenticalWindow) {
      console.log(
        "PASS — FIX VERIFIED: an early-morning (02:00) Tashkent-local sale is correctly counted as 'today' regardless of the " +
          "server process's own TZ, and all three processes computed the exact same UTC window. This is the specific bug that " +
          "used to exist (early-morning Tashkent orders misbucketed as 'yesterday' when the server ran in UTC) — it is now closed.",
      );
    } else {
      console.log("FAIL — regression: TZ-independence or correct Tashkent bucketing no longer holds. Investigate before trusting reports.");
      process.exitCode = 1;
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
