import type { SaleType } from "@/entities/product/model";

export type OwnerSaleStatus = "ACCEPTED" | "CANCELLED";

export type OwnerSaleListItem = {
  id: string;
  receiptNumber: string;
  tableNumber: number | null;
  sellerName: string;
  createdAt: string;
  totalAmount: string;
  status: OwnerSaleStatus;
  itemCount: number;
};

export type OwnerSalesList = {
  items: OwnerSaleListItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type SaleChangeType = "ITEM_REMOVED" | "ITEM_ADDED" | "QUANTITY_CHANGED" | "PRICE_CHANGED" | "SALE_CANCELLED";

export type SaleChangeLogEntry = {
  id: string;
  changeType: SaleChangeType;
  description: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  performedByName: string;
  performedAt: string;
};

export type OwnerSaleItem = {
  id: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  saleType: SaleType;
  quantity: string;
  unitPrice: string;
  subtotal: string;
  removedAt: string | null;
  removedByName: string | null;
  removeReason: string | null;
};

export type OwnerSaleDetail = {
  id: string;
  receiptNumber: string;
  tableNumber: number | null;
  sellerName: string;
  totalAmount: string;
  status: OwnerSaleStatus;
  createdAt: string;
  acceptedAt: string | null;
  cancelledAt: string | null;
  cancelledByName: string | null;
  cancelReason: string | null;
  items: OwnerSaleItem[];
  changeLogs: SaleChangeLogEntry[];
};

export type UpdateSaleItemInput = {
  quantity?: number;
  unitPrice?: number;
  reason?: string;
};

export type AddSaleItemInput = {
  variantId: string;
  quantity: number;
  reason?: string;
};
