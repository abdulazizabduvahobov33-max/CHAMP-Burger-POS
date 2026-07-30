import type { Unit } from "@/entities/ingredient/model";

export type PurchaseListItem = {
  id: string;
  supplierName: string | null;
  purchaseDate: string;
  totalCost: string;
  note: string | null;
  itemCount: number;
};

export type PurchaseItemDetail = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  unit: Unit;
  packQuantity: string;
  unitsPerPack: string;
  packPrice: string;
  totalUnits: string;
  unitCost: string;
  lineTotal: string;
};

export type PurchaseDetail = {
  id: string;
  supplierId: string | null;
  supplierName: string | null;
  purchaseDate: string;
  totalCost: string;
  note: string | null;
  createdByName: string;
  items: PurchaseItemDetail[];
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type PurchasesListSummary = { totalCost: string; count: number };
export type PurchasesList = Paginated<PurchaseListItem> & { summary: PurchasesListSummary };

export type PurchaseItemInput = {
  ingredientId: string;
  packQuantity: number;
  unitsPerPack: number;
  packPrice: number;
};

export type CreatePurchaseInput = {
  supplierId?: string;
  note?: string;
  items: PurchaseItemInput[];
};
