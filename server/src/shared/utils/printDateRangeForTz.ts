/**
 * Standalone entrypoint used only by dateRange.test.ts's cross-process TZ-independence check —
 * prints resolveDateRange()'s output as JSON so it can be spawned under different `TZ` env vars
 * and compared. Not imported anywhere else; not part of the running server.
 *
 * Usage: npx tsx src/shared/utils/printDateRangeForTz.ts <preset> [from] [to]
 */
import { resolveDateRange, type DatePreset } from "./dateRange.js";

const preset = (process.argv[2] ?? "today") as DatePreset;
const from = process.argv[3];
const to = process.argv[4];

const range = resolveDateRange(preset, from, to);
console.log(JSON.stringify({ start: range.start.toISOString(), end: range.end.toISOString() }));
