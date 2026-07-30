import { localeForNumberFormat } from "@/shared/lib/locale";
import type { ProductVariant } from "./model";

export function formatPrice(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString(localeForNumberFormat(), { maximumFractionDigits: 2 });
}

/** Tailwind color class for a profit figure — red for a loss, green otherwise. A raw
 * `text-success` on a negative number (a sale at a loss, e.g. an ingredient's cost rose above
 * the item's selling price) would read as "good" when it's actually a warning sign. */
export function profitColorClass(value: string): string {
  return Number(value) < 0 ? "text-danger-soft" : "text-success";
}

export function formatPriceRange(variants: ProductVariant[]): string {
  if (variants.length === 0) return "—";
  const prices = variants.map((v) => Number(v.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPrice(String(min)) : `${formatPrice(String(min))}–${formatPrice(String(max))}`;
}
