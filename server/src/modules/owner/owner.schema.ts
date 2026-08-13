import { z } from "zod";

// Free-text, optional everywhere — the change log always captures who/when/what/old→new
// regardless; a reason is a nice-to-have annotation on top, not something that should slow the
// owner down fixing a trivial mistake (see the module spec: "исправить ошибку за несколько
// секунд"). Trimmed so a whitespace-only value renders as "no reason given", not a blank line.
const reasonSchema = z.string().trim().max(300).optional();

export const listOwnerSalesQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(120).optional(),
});

export const removeSaleItemSchema = z.object({
  reason: reasonSchema,
});

export const updateSaleItemSchema = z
  .object({
    quantity: z.coerce.number().positive("Количество должно быть больше нуля").optional(),
    unitPrice: z.coerce.number().nonnegative("Цена не может быть отрицательной").optional(),
    reason: reasonSchema,
  })
  .refine((v) => v.quantity !== undefined || v.unitPrice !== undefined, {
    message: "Укажите новое количество или цену",
  });

export const addSaleItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().positive("Количество должно быть больше нуля"),
  reason: reasonSchema,
});

export const cancelSaleSchema = z.object({
  reason: reasonSchema,
});

export type ListOwnerSalesQuery = z.infer<typeof listOwnerSalesQuerySchema>;
export type RemoveSaleItemInput = z.infer<typeof removeSaleItemSchema>;
export type UpdateSaleItemInput = z.infer<typeof updateSaleItemSchema>;
export type AddSaleItemInput = z.infer<typeof addSaleItemSchema>;
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;
