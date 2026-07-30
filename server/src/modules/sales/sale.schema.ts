import { z } from "zod";

const saleItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().positive("Количество должно быть больше нуля"),
});

export const createSaleSchema = z.object({
  items: z.array(saleItemSchema).min(1, "Корзина пуста"),
});

export type SaleItemInput = z.infer<typeof saleItemSchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
