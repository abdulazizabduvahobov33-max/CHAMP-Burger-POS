export type Supplier = {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  createdAt: string;
};

export type SupplierFormInput = {
  name: string;
  phone?: string;
  note?: string;
};
