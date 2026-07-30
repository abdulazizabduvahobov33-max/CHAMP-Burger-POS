import { z } from "zod";

import { AppError } from "../../middleware/error.js";

export const DATE_PRESETS = ["today", "yesterday", "week", "month", "custom"] as const;
export type DatePreset = (typeof DATE_PRESETS)[number];

export type ResolvedDateRange = { start: Date; end: Date };

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function daysBefore(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - days);
  return copy;
}

/**
 * Parses a "YYYY-MM-DD" string strictly — `new Date("2026-02-30T00:00:00")` doesn't produce
 * NaN, it silently rolls over to 2026-03-02, so a plain isNaN check lets malformed-but-valid-
 * looking dates through. Re-deriving the components and comparing catches that rollover.
 */
function parseCalendarDate(value: string): Date {
  const date = new Date(`${value}T00:00:00`);
  const [year, month, day] = value.split("-").map(Number);
  const rolledOver = date.getFullYear() !== year || date.getMonth() + 1 !== month || date.getDate() !== day;
  if (Number.isNaN(date.getTime()) || rolledOver) {
    throw new AppError(422, "INVALID_RANGE", "Некорректная дата");
  }
  return date;
}

/**
 * Turns a filter preset (or explicit "from"/"to" for "custom") into concrete start/end
 * Dates. "week"/"month" are rolling windows ending today (last 7 / last 30 days), not
 * calendar week/month — avoids a near-empty "this month" card on the 1st.
 *
 * Shared by every report endpoint so "Неделя" means the exact same thing on the dashboard,
 * the sales list, and top products — and so any future report (margin, cost) gets identical
 * date-range semantics for free instead of re-implementing this.
 *
 * "Today" (and every boundary derived from it) is the SERVER PROCESS's local timezone —
 * there's no per-business timezone setting anywhere in this app (Sale.createdAt itself is
 * just `@default(now())`). Deploy the server in the timezone the shop actually operates in,
 * or these boundaries roll over at the wrong wall-clock hour.
 */
export function resolveDateRange(preset: DatePreset, from?: string, to?: string): ResolvedDateRange {
  const now = new Date();

  switch (preset) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "yesterday": {
      const yesterday = daysBefore(now, 1);
      return { start: startOfDay(yesterday), end: endOfDay(yesterday) };
    }
    case "week":
      return { start: startOfDay(daysBefore(now, 6)), end: endOfDay(now) };
    case "month":
      return { start: startOfDay(daysBefore(now, 29)), end: endOfDay(now) };
    case "custom": {
      // zod already requires from/to together for "custom" — this is a defensive fallback,
      // not the primary guard.
      if (!from || !to) {
        throw new AppError(422, "INVALID_RANGE", "Укажите начало и конец периода");
      }
      const start = startOfDay(parseCalendarDate(from));
      const end = endOfDay(parseCalendarDate(to));
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
