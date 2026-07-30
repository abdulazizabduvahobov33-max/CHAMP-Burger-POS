import i18n from "@/shared/i18n";
import { localeForNumberFormat } from "@/shared/lib/locale";
import { UNIT_LABELS, type Unit } from "./model";

/** "12.500" -> "12.5"; drops trailing zeros without touching the decimal separator. */
export function formatQuantity(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString(localeForNumberFormat(), { maximumFractionDigits: 3 });
}

// Not a hook — used by plain formatting helpers as well as component render bodies, so this
// reads the shared i18n instance directly (same reasoning as shared/lib/errors.ts).
export function formatQuantityWithUnit(value: string, unit: Unit): string {
  return `${formatQuantity(value)} ${i18n.t(UNIT_LABELS[unit])}`;
}
