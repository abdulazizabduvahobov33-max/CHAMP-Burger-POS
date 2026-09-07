import { execSync } from "node:child_process";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { resolveDateRange } from "./dateRange.js";

// All expected instants below were independently cross-checked with Node's Intl formatter
// against Asia/Tashkent (UTC+5, no DST) before being hardcoded here — see the conversation
// history for the verification run. They are not derived by re-running the code under test.

describe("resolveDateRange — computed in Asia/Tashkent regardless of process time", () => {
  beforeEach(() => {
    // Deliberately real Date, not vi.useFakeTimers — this exercises the actual Intl-based
    // conversion, not a mocked clock, and setSystemTime is enough to control "now" here.
  });
  afterEach(() => {
    // no-op placeholder kept for symmetry / future fake-timer use
  });

  it("today: 2026-09-07 15:00 Tashkent (10:00Z) → Sep7 00:00 local .. Sep7 23:59:59.999 local", () => {
    const now = new Date("2026-09-07T10:00:00.000Z");
    const range = resolveDateRangeAt(now, "today");
    expect(range.start.toISOString()).toBe("2026-09-06T19:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-07T18:59:59.999Z");
  });

  it("yesterday: same 'now' → Sep6 00:00 local .. Sep6 23:59:59.999 local", () => {
    const now = new Date("2026-09-07T10:00:00.000Z");
    const range = resolveDateRangeAt(now, "yesterday");
    expect(range.start.toISOString()).toBe("2026-09-05T19:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-06T18:59:59.999Z");
  });

  it("week (rolling 7 days ending today): Sep1 00:00 local .. Sep7 23:59:59.999 local", () => {
    const now = new Date("2026-09-07T10:00:00.000Z");
    const range = resolveDateRangeAt(now, "week");
    expect(range.start.toISOString()).toBe("2026-08-31T19:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-07T18:59:59.999Z");
  });

  it("month (rolling 30 days ending today): Aug9 00:00 local .. Sep7 23:59:59.999 local", () => {
    const now = new Date("2026-09-07T10:00:00.000Z");
    const range = resolveDateRangeAt(now, "month");
    expect(range.start.toISOString()).toBe("2026-08-08T19:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-07T18:59:59.999Z");
  });

  it("custom range covering a full calendar month (start/end of month, Sep1..Sep30 local)", () => {
    const range = resolveDateRange("custom", "2026-09-01", "2026-09-30");
    expect(range.start.toISOString()).toBe("2026-08-31T19:00:00.000Z"); // Sep1 00:00:00.000 local
    expect(range.end.toISOString()).toBe("2026-09-30T18:59:59.999Z"); // Sep30 23:59:59.999 local
  });

  it("midnight boundary: 23:59:59.999 Tashkent is still 'today', 00:00:00.000 the next instant flips to the next day", () => {
    const justBeforeMidnight = new Date("2026-09-07T18:59:59.999Z"); // Sep7 23:59:59.999 local
    const justAfterMidnight = new Date("2026-09-07T19:00:00.000Z"); // Sep8 00:00:00.000 local

    const beforeRange = resolveDateRangeAt(justBeforeMidnight, "today");
    expect(beforeRange.start.toISOString()).toBe("2026-09-06T19:00:00.000Z");
    expect(beforeRange.end.toISOString()).toBe("2026-09-07T18:59:59.999Z");

    const afterRange = resolveDateRangeAt(justAfterMidnight, "today");
    expect(afterRange.start.toISOString()).toBe("2026-09-07T19:00:00.000Z");
    expect(afterRange.end.toISOString()).toBe("2026-09-08T18:59:59.999Z");
  });

  it("rejects an invalid custom date (Feb 30) without silently rolling it over, regardless of timezone", () => {
    expect(() => resolveDateRange("custom", "2026-02-30", "2026-03-01")).toThrow();
  });
});

describe("resolveDateRange — identical output whether the PROCESS runs in UTC or an unrelated timezone", () => {
  it(
    "today/week/month/custom resolve byte-identically under TZ=UTC and TZ=America/New_York",
    () => {
      const utc = runInChildProcess("UTC");
      const nyc = runInChildProcess("America/New_York");
      expect(utc).toEqual(nyc);
      // Sanity: this isn't a vacuous "both empty" comparison — confirm real ISO timestamps came back.
      expect(utc.today.start).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    },
    30000,
  );
});

/**
 * The exported resolveDateRange() always uses the real current instant for "today"-relative
 * presets — there's no injectable "now" parameter (by design: report endpoints never need one).
 * To test specific instants deterministically without adding a test-only parameter to
 * production code, temporarily stub the global Date constructor's "now" via a minimal shim: we
 * don't need vi.useFakeTimers' full timer machinery, just Date.now()/`new Date()` with no args.
 */
function resolveDateRangeAt(now: Date, preset: Parameters<typeof resolveDateRange>[0]) {
  const RealDate = Date;
  class FixedDate extends RealDate {
    constructor(...args: unknown[]) {
      if (args.length === 0) {
        super(now.getTime());
      } else {
        // @ts-expect-error - forwarding whatever arguments were given to the real constructor
        super(...args);
      }
    }
    static now() {
      return now.getTime();
    }
  }
  // @ts-expect-error - intentional global stub, restored immediately after use
  globalThis.Date = FixedDate;
  try {
    return resolveDateRange(preset, undefined, undefined);
  } finally {
    globalThis.Date = RealDate;
  }
}

function runInChildProcess(tz: string) {
  const presets: Array<[string, string[]]> = [
    ["today", ["today"]],
    ["week", ["week"]],
    ["month", ["month"]],
    ["custom", ["custom", "2026-09-01", "2026-09-30"]],
  ];
  const result: Record<string, { start: string; end: string }> = {};
  for (const [label, args] of presets) {
    const output = execSync(`npx tsx src/shared/utils/printDateRangeForTz.ts ${args.join(" ")}`, {
      env: { ...process.env, TZ: tz },
      encoding: "utf-8",
    });
    result[label] = JSON.parse(output.trim());
  }
  return result;
}
