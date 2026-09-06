import type { SaleType } from "@/entities/product/model";

export type SaleItemLine = {
  variantId: string;
  quantity: number;
};

export type CreateSaleInput = {
  items: SaleItemLine[];
  cashReceived?: number;
  tableId?: string;
  // Idempotency key — see PosCart.tsx (where it's minted) and server/.../sale.service.ts's
  // createSale (where it's enforced) for why: a retried request for the same checkout attempt
  // must return the original sale, never create a second one.
  clientRequestId?: string;
};

export type SaleItemResult = {
  id: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  saleType: SaleType;
  quantity: string;
  unitPrice: string;
  subtotal: string;
};

export type SaleStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "CANCELLED";

export type Sale = {
  id: string;
  receiptNumber: string;
  tableNumber: number | null;
  totalAmount: string;
  cashReceived: string | null;
  changeGiven: string | null;
  status: SaleStatus;
  acceptedAt: string | null;
  createdAt: string;
  items: SaleItemResult[];
};

export type MySaleListItem = {
  id: string;
  receiptNumber: string;
  tableNumber: number | null;
  createdAt: string;
  totalAmount: string;
  cashReceived: string | null;
  changeGiven: string | null;
  status: SaleStatus;
  itemCount: number;
};

export type MySalesList = {
  items: MySaleListItem[];
  page: number;
  pageSize: number;
  total: number;
};

export type AcceptSaleInput = {
  cashReceived?: number;
};

export type PendingSaleItem = {
  id: string;
  productName: string;
  variantLabel: string;
  saleType: SaleType;
  quantity: string;
  subtotal: string;
};

export type PendingSale = {
  id: string;
  receiptNumber: string;
  tableNumber: number | null;
  sellerName: string;
  totalAmount: string;
  createdAt: string;
  items: PendingSaleItem[];
};
