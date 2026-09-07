import { z } from "zod";

import { AppError } from "../../middleware/error.js";

export const DATE_PRESETS = ["today", "yesterday", "week", "month", "custom"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export type ResolvedDateRange = { start: Date; end: Date };

/**
 * The business this app runs for operates in Uzbekistan — every report boundary below is
 * computed against THIS zone explicitly, never against `process.env.TZ` or the host's local
 * time. Uzbekistan has used a fixed UTC+5 offset with no DST since 1992, but this still goes
 * through the real IANA tzdata (via Intl) rather than a hardcoded "+05:00" so it keeps being
 * correct even if that were ever legislated differently — see zonedMidnightUtc below.
 *
 * Setting a Render `TZ=Asia/Tashkent` env var on top of this is fine as defense-in-depth (it
 * would make ad-hoc `new Date()`/log timestamps elsewhere in the app read naturally in local
 * time too), but it must never be load-bearing for report correctness — this module doesn't
 * read `process.env.TZ` at all, by design, precisely so report boundaries stay correct even if
 * that env var is missing, wrong, or the process is later moved to a host in another region.
 */
const BUSINESS_TIME_ZONE = "Asia/Tashkent";

type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const zonedPartsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: BUSINESS_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** The wall-clock date/time this UTC instant reads as in BUSINESS_TIME_ZONE. */
function getZonedParts(instant: Date): ZonedParts {
  const raw: Record<string, string> = {};
  for (const part of zonedPartsFormatter.formatToParts(instant)) {
    if (part.type !== "literal") raw[part.type] = part.value;
  }
  return {
    year: Number(raw.year),
    month: Number(raw.month),
    day: Number(raw.day),
    hour: Number(raw.hour),
    minute: Number(raw.minute),
    second: Number(raw.second),
  };
}

/**
 * The UTC instant corresponding to 00:00:00.000 local wall-clock time on the given calendar
 * date in BUSINESS_TIME_ZONE. Works by taking that Y-M-D as a NAIVE UTC instant, reading back
 * what wall-clock time that instant is in the target zone (which reveals the zone's current
 * offset from UTC), and subtracting that offset — e.g. for Tashkent (UTC+5), 2026-09-07T00:00Z
 * reads as 2026-09-07 05:00 local, an offset of +5h, so real local midnight is 2026-09-07T00:00Z
 * minus 5h = 2026-09-06T19:00:00.000Z.
 */
function zonedMidnightUtc(year: number, month: number, day: number): Date {
  const naiveUtcMs = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const zonedAtNaive = getZonedParts(new Date(naiveUtcMs));
  const zonedAsUtcMs = Date.UTC(
    zonedAtNaive.year,
    zonedAtNaive.month - 1,
    zonedAtNaive.day,
    zonedAtNaive.hour,
    zonedAtNaive.minute,
    zonedAtNaive.second,
  );
  const offsetMs = zonedAsUtcMs - naiveUtcMs;
  return new Date(naiveUtcMs - offsetMs);
}

function zonedStartOfDay(instant: Date): Date {
  const p = getZonedParts(instant);
  return zonedMidnightUtc(p.year, p.month, p.day);
}

function zonedEndOfDay(instant: Date): Date {
  return new Date(zonedStartOfDay(instant).getTime() + 24 * 60 * 60 * 1000 - 1);
}

/** Pure calendar-date arithmetic (no timezone involved) — shifts a Y-M-D by `delta` days. */
function shiftCalendarDate(year: number, month: number, day: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + delta);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/**
 * Parses a "YYYY-MM-DD" string strictly and independent of any timezone — `new Date("2026-02-
 * 30T00:00:00")` doesn't produce NaN, it silently rolls over to 2026-03-02, so a plain isNaN
 * check lets malformed-but-valid-looking dates through. Re-deriving the components via UTC-only
 * math and comparing catches that rollover without depending on process-local time semantics.
 */
function parseCalendarDateParts(value: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new AppError(422, "INVALID_RANGE", "Некорректная дата");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const asUtc = new Date(Date.UTC(year, month - 1, day));
  const rolledOver = asUtc.getUTCFullYear() !== year || asUtc.getUTCMonth() + 1 !== month || asUtc.getUTCDate() !== day;
  if (rolledOver) {
    throw new AppError(422, "INVALID_RANGE", "Некорректная дата");
  }
  return { year, month, day };
}

/**
 * Turns a filter preset (or explicit "from"/"to" for "custom") into concrete start/end Dates,
 * all computed in BUSINESS_TIME_ZONE (see the constant's comment above) regardless of what
 * timezone this process happens to be running in. "week"/"month" are rolling windows ending
 * today (last 7 / last 30 days), not calendar week/month — avoids a near-empty "this month"
 * card on the 1st.
 *
 * Shared by every report endpoint so "Неделя" means the exact same thing on the dashboard,
 * the sales list, and top products — and so any future report (margin, cost) gets identical
 * date-range semantics for free instead of re-implementing this.
 */
export function resolveDateRange(preset: DatePreset, from?: string, to?: string): ResolvedDateRange {
  const now = new Date();
  const todayParts = getZonedParts(now);

  switch (preset) {
    case "today": {
      const start = zonedMidnightUtc(todayParts.year, todayParts.month, todayParts.day);
      return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1) };
    }
    case "yesterday": {
      const y = shiftCalendarDate(todayParts.year, todayParts.month, todayParts.day, -1);
      const start = zonedMidnightUtc(y.year, y.month, y.day);
      return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1) };
    }
    case "week": {
      const s = shiftCalendarDate(todayParts.year, todayParts.month, todayParts.day, -6);
      return { start: zonedMidnightUtc(s.year, s.month, s.day), end: zonedEndOfDay(now) };
    }
    case "month": {
      const s = shiftCalendarDate(todayParts.year, todayParts.month, todayParts.day, -29);
      return { start: zonedMidnightUtc(s.year, s.month, s.day), end: zonedEndOfDay(now) };
    }
    case "custom": {
      // zod already requires from/to together for "custom" — this is a defensive fallback,
      // not the primary guard.
      if (!from || !to) {
        throw new AppError(422, "INVALID_RANGE", "Укажите начало и конец периода");
      }
      const fromParts = parseCalendarDateParts(from);
      const toParts = parseCalendarDateParts(to);
      const start = zonedMidnightUtc(fromParts.year, fromParts.month, fromParts.day);
      const end = new Date(zonedMidnightUtc(toParts.year, toParts.month, toParts.day).getTime() + 24 * 60 * 60 * 1000 - 1);
      if (start > end) {
        throw new AppError(422, "INVALID_RANGE", "Начало периода не может быть позже конца");
      }
      return { start, end };
    }
  }
}

const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ожидается дата в формате ГГГГ-ММ-ДД")
  .optional();

/** Every date-filtered list query (reports, purchases, ...) shares this shape + the same
 * "custom needs from/to" rule — defined once so every caller means the same thing by
 * "Неделя"/"Период" instead of re-implementing the refinement. */
export function withDateRange<T extends z.ZodRawShape>(shape: T, defaultPreset: DatePreset = "today") {
  return z
    .object({ preset: z.enum(DATE_PRESETS).default(defaultPreset), ...shape, from: dateStringSchema, to: dateStringSchema })
    .refine((data) => data.preset !== "custom" || Boolean(data.from && data.to), {
      message: "Укажите начало и конец периода для произвольного диапазона",
      path: ["from"],
    });
}
