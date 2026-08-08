export type Unit = "PIECE" | "KG" | "G" | "L" | "ML";

// Values are i18n keys, not display text — call sites resolve them via useTranslation()'s t(),
// e.g. t(UNIT_LABELS[unit]). Keeping the map here (rather than only in the JSON files) means
// every UNIT_OPTIONS-driven <select> still gets a single, typed source of truth for which
// units exist, exactly as before — only what's stored under each key changed.
export const UNIT_LABELS: Record<Unit, string> = {
  PIECE: "ingredient.unit.PIECE",
  KG: "ingredient.unit.KG",
  G: "ingredient.unit.G",
  L: "ingredient.unit.L",
  ML: "ingredient.unit.ML",
};

export const UNIT_OPTIONS: Unit[] = ["PIECE", "KG", "G", "L", "ML"];

export type Ingredient = {
  id: string;
  name: string;
  unit: Unit;
  minQuantity: string;
  quantity: string;
  isLow: boolean;
  isActive: boolean;
  createdAt: string;
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type StockMovementReason = "PURCHASE" | "SALE" | "ADJUST" | "WASTE";

export const MOVEMENT_REASON_LABELS: Record<StockMovementReason, string> = {
  PURCHASE: "ingredient.movementReason.PURCHASE",
  SALE: "ingredient.movementReason.SALE",
  ADJUST: "ingredient.movementReason.ADJUST",
  WASTE: "ingredient.movementReason.WASTE",
};

export type StockMovement = {
  id: string;
  change: string;
  // Null for movements recorded before these columns existed.
  quantityBefore: string | null;
  quantityAfter: string | null;
  reason: StockMovementReason;
  note: string | null;
  createdAt: string;
  createdByName: string;
};

export type IngredientListQuery = {
  search?: string;
  unit?: Unit;
  lowStock?: boolean;
  page: number;
  pageSize: number;
};

export type IngredientFormInput = {
  name: string;
  unit: Unit;
  minQuantity: number;
};

export type StockAmountInput = {
  quantity: number;
  note?: string;
};

export type BulkRestockItem = {
  ingredientId: string;
  quantity: number;
  note?: string;
};

export type BulkRestockInput = {
  items: BulkRestockItem[];
};

// Three-way status derived client-side from quantity vs minQuantity — a finer read than the
// server's `isLow` boolean (which only distinguishes "below minimum" from "not"), used by the
// stock-intake grid and the ingredient directory to color-code rows.
export type StockStatus = "out" | "low" | "ok";

export function getStockStatus(quantity: string, minQuantity: string): StockStatus {
  const qty = Number(quantity);
  if (qty <= 0) return "out";
  if (qty < Number(minQuantity)) return "low";
  return "ok";
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  out: "warehouse.status.out",
  low: "warehouse.status.low",
  ok: "warehouse.status.ok",
};

export const STOCK_STATUS_CLASSES: Record<StockStatus, string> = {
  out: "text-danger-soft",
  low: "text-warn",
  ok: "text-success",
};

// Background + text combo for pill badges (stock-intake grid) — text-only variant above is for
// table cells / big numbers where a filled background would be too heavy.
export const STOCK_STATUS_BADGE_CLASSES: Record<StockStatus, string> = {
  out: "bg-danger/10 text-danger-soft",
  low: "bg-warn/10 text-warn",
  ok: "bg-success/10 text-success",
};
