/**
 * Standalone login-timing side-channel probe — run as its OWN process (spawned by
 * authSecurityAudit.ts) specifically because the login rate limiter is a module-level singleton
 * per process: every `createApp()` call within the SAME process shares one loginLimiter instance
 * (routes are imported once, cached by Node's module system), so a script that already spent
 * most of its 10-request/15-min budget on legitimate logins has no room left for N-sample timing
 * probes. A fresh process gets a genuinely fresh limiter.
 *
 * Measures whether "no such user" (short-circuits before bcrypt.compare — see auth.service.ts's
 * login()) responds measurably faster than "wrong password for a real user" (bcrypt.compare
 * DOES run). Read-only — creates no fixtures, only logs in with real vs fabricated logins
 * against the real HTTP app. Does not assert pass/fail; reports the gap for the audit's own
 * report to size the severity of.
 *
 * Usage: npx tsx prisma/authTimingCheck.ts <existing-real-login>
 */
import request from "supertest";

async function main() {
  const realLogin = process.argv[2];
  if (!realLogin) {
    console.error("Usage: authTimingCheck.ts <existing-real-login>");
    process.exit(1);
  }

  const { createApp } = await import("../src/app.js");
  const agent = request(createApp());

  // 5 + 5 = 10, exactly the loginLimiter's max — leaves zero headroom, so this must be the ONLY
  // thing this process's login budget is ever spent on.
  const ITER = 5;
  const timeIt = async (login: string) => {
    const samples: number[] = [];
    for (let i = 0; i < ITER; i++) {
      const start = process.hrtime.bigint();
      const res = await agent.post("/api/auth/login").send({ login, password: `probe-${i}` });
      if (res.status === 429) {
        console.log(`INCONCLUSIVE — hit the rate limiter after ${samples.length} samples for "${login}"; measurement invalid.`);
        return null;
      }
      samples.push(Number(process.hrtime.bigint() - start) / 1e6);
    }
    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length / 2)];
  };

  const nonexistentMedianMs = await timeIt(`auth_audit_timing_probe_${Date.now()}`);
  const realUserMedianMs = await timeIt(realLogin);

  if (nonexistentMedianMs === null || realUserMedianMs === null) {
    console.log("INFO — login timing: measurement inconclusive (rate limiter engaged mid-sample).");
    return;
  }

  const gapMs = realUserMedianMs - nonexistentMedianMs;
  console.log(
    `INFO — login timing: nonexistent-user median=${nonexistentMedianMs.toFixed(1)}ms, real-user-wrong-password median=${realUserMedianMs.toFixed(1)}ms, ` +
      `gap=${gapMs.toFixed(1)}ms over ${ITER} samples each (bcrypt.compare only runs for a real user)`,
  );
}

main().catch((err) => {
  console.error("Timing check failed:", err);
  process.exitCode = 1;
});
