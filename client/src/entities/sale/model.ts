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

export type Sale = {
  id: string;
  totalAmount: string;
  cashReceived: string | null;
  changeGiven: string | null;
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
  itemCount: number;
};

export type MySalesList = {
  items: MySaleListItem[];
  page: number;
  pageSize: number;
  total: number;
};
