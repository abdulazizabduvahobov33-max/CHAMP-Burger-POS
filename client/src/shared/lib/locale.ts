import i18n from "@/shared/i18n";

/**
 * Locale string for `Number.toLocaleString`/`Intl.NumberFormat` — grouping/decimal separators
 * follow the active UI language instead of being hardcoded to Russian everywhere prices and
 * quantities are displayed (entities/product/lib.ts, entities/ingredient/lib.ts).
 */
export function localeForNumberFormat(): string {
  return i18n.language === "uz" ? "uz-UZ" : "ru-RU";
}
