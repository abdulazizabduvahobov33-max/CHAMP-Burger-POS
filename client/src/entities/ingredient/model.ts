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
