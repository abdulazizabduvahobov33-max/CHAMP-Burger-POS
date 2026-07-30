import { Unit } from "@prisma/client";
import { z } from "zod";

export const createIngredientSchema = z.object({
  name: z.string().trim().min(1, "Введите название").max(120),
  unit: z.nativeEnum(Unit, { errorMap: () => ({ message: "Некорректная единица измерения" }) }),
  minQuantity: z.coerce.number().min(0, "Минимальный остаток не может быть отрицательным").default(0),
});

export const updateIngredientSchema = z.object({
  name: z.string().trim().min(1, "Введите название").max(120).optional(),
  unit: z.nativeEnum(Unit).optional(),
  minQuantity: z.coerce.number().min(0, "Минимальный остаток не может быть отрицательным").optional(),
});

export const listIngredientsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  unit: z.nativeEnum(Unit).optional(),
  lowStock: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const stockAmountSchema = z.object({
  quantity: z.coerce.number().positive("Количество должно быть больше нуля"),
  note: z.string().trim().max(300).optional(),
});

export const movementsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateIngredientInput = z.infer<typeof createIngredientSchema>;
export type UpdateIngredientInput = z.infer<typeof updateIngredientSchema>;
export type ListIngredientsQuery = z.infer<typeof listIngredientsQuerySchema>;
export type StockAmountInput = z.infer<typeof stockAmountSchema>;
export type MovementsQuery = z.infer<typeof movementsQuerySchema>;
