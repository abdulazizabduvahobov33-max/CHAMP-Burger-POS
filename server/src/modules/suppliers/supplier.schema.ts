import { z } from "zod";

export const createSupplierSchema = z.object({
  name: z.string().trim().min(1, "Введите название поставщика").max(120),
  phone: z.string().trim().max(40).optional(),
  note: z.string().trim().max(300).optional(),
});

export const updateSupplierSchema = createSupplierSchema;

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
