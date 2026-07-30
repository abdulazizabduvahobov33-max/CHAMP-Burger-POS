export type SaleItemLine = {
  variantId: string;
  quantity: number;
};

export type CreateSaleInput = {
  items: SaleItemLine[];
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
  createdAt: string;
  items: SaleItemResult[];
};
