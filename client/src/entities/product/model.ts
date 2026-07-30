export type SaleType = "UNIT" | "WEIGHT" | "DIRECT";

// Values are i18n keys (see entities/ingredient/model.ts's UNIT_LABELS for why).
export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  UNIT: "product.saleType.UNIT",
  WEIGHT: "product.saleType.WEIGHT",
  DIRECT: "product.saleType.DIRECT",
};

export const SALE_TYPE_OPTIONS: SaleType[] = ["UNIT", "WEIGHT", "DIRECT"];

export type ProductVariant = {
  id: string;
  label: string;
  price: string;
};

export type Product = {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  imageUrl: string | null;
  saleType: SaleType;
  isActive: boolean;
  createdAt: string;
  variants: ProductVariant[];
};

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProductListQuery = {
  search?: string;
  categoryId?: string;
  saleType?: SaleType;
  isActive?: boolean;
  page: number;
  pageSize: number;
};

export type VariantFormInput = {
  // Present when resubmitting an existing variant — keeps its identity (and anything
  // referencing it, e.g. a Recipe) intact instead of the server recreating it under a new id.
  id?: string;
  label: string;
  price: number;
};

export type ProductFormInput = {
  name: string;
  categoryId: string;
  saleType: SaleType;
  imageUrl?: string | null;
  variants: VariantFormInput[];
};
