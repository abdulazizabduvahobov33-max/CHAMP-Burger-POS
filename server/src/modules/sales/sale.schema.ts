import { z } from "zod";

const saleItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().positive("Количество должно быть больше нуля"),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, "Корзина пуста"),
  // Optional: the POS's payment dialog always sends it for a cash checkout, but the field stays
  // optional at the schema level so a future non-cash payment method isn't forced to invent one.
  cashReceived: z.coerce.number().nonnegative("Сумма не может быть отрицательной").optional(),
});

export const listMySalesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type ListMySalesQuery = z.infer<typeof listMySalesQuerySchema>;
