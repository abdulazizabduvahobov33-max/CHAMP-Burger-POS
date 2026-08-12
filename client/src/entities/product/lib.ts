import i18n from "@/shared/i18n";
import { localeForNumberFormat } from "@/shared/lib/locale";
import type { ProductVariant, SaleType } from "./model";

export function formatPrice(value: string): string {
  const n = Number(value);
  if (Number.isNaN(n)) return value;
  return n.toLocaleString(localeForNumberFormat(), { maximumFractionDigits: 2 });
}

/**
 * A UNIT product's quantity is just a count ("2") — unchanged from how it's always rendered.
 * A WEIGHT product's quantity is a kilogram amount stored with 3-decimal (gram) precision; this
 * always shows exactly 3 decimals with the locale's own kg abbreviation ("0,800 кг" / "0.800 kg")
 * so a fresh, non-1kg, non-round sale still reads clearly instead of a bare "0.8" that looks like
 * a typo. Reuses ingredient.unit.KG rather than a second "kg" translation.
 *
 * One function, used at every quantity display site (cart, receipt, order history, admin
 * reports) — a third sale type sold by some other measure (litres, say) is a new branch here,
 * not a hunt through the app for every place a quantity is printed.
 */
export function formatSaleQuantity(quantity: string | number, saleType: SaleType): string {
  if (saleType === "WEIGHT") {
    const kg = Number(quantity).toLocaleString(localeForNumberFormat(), {
      minimumFractionDigits: 3,
      maximumFractionDigits: 3,
    });
    return `${kg} ${i18n.t("ingredient.unit.KG")}`;
  }
  return String(quantity);
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
