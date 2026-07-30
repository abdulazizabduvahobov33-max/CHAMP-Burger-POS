import { z } from "zod";

import { withDateRange } from "../../shared/utils/dateRange.js";

export const purchaseItemInputSchema = z.object({
  ingredientId: z.string().min(1, "Выберите ингредиент"),
  packQuantity: z.coerce.number().positive("Количество упаковок должно быть больше нуля"),
  unitsPerPack: z.coerce.number().positive("Количество в упаковке должно быть больше нуля"),
  packPrice: z.coerce.number().nonnegative("Цена не может быть отрицательной"),
});

export const createPurchaseSchema = z.object({
  supplierId: z.string().min(1).optional(),
  note: z.string().trim().max(300).optional(),
  items: z.array(purchaseItemInputSchema).min(1, "Добавьте хотя бы одну позицию"),
});

export const listPurchasesQuerySchema = withDateRange(
  {
    search: z.string().trim().max(120).optional(),
    supplierId: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
  },
  "month",
);

export type PurchaseItemInput = z.infer<typeof purchaseItemInputSchema>;
export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type ListPurchasesQuery = z.infer<typeof listPurchasesQuerySchema>;
