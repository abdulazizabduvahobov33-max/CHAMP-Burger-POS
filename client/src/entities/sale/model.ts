export type SaleItemLine = {
  variantId: string;
  quantity: number;
};

export type CreateSaleInput = {
  items: SaleItemLine[];
  cashReceived?: number;
};

export type SaleItemResult = {
  id: string;
  variantId: string;
  productName: string;
  variantLabel: string;
  quantity: string;
  unitPrice: string;
  subtotal: string;
};

export type SaleStatus = "PENDING" | "ACCEPTED";

export type Sale = {
  id: string;
  receiptNumber: string;
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
  quantity: string;
  subtotal: string;
};

export type PendingSale = {
  id: string;
  receiptNumber: string;
  sellerName: string;
  totalAmount: string;
  createdAt: string;
  items: PendingSaleItem[];
};
