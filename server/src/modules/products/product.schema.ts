import { SaleType } from "@prisma/client";
import { z } from "zod";

const variantSchema = z.object({
  // Present when this row is an existing variant being re-submitted (kept so its id, and
  // anything referencing it — Recipe/SaleItem — survives an edit); absent for a new row.
  id: z.string().optional(),
  label: z.string().trim().min(1, "Укажите название варианта").max(60),
  price: z.coerce.number().nonnegative("Цена не может быть отрицательной"),
});

export const createProductSchema = z.object({
  name: z.string().trim().min(1, "Введите название").max(120),
  categoryId: z.string().min(1, "Выберите категорию"),
  saleType: z.nativeEnum(SaleType, { errorMap: () => ({ message: "Некорректный тип продажи" }) }),
  imageUrl: z.string().trim().max(300).nullish(),
  variants: z.array(variantSchema).min(1, "Добавьте хотя бы один вариант цены"),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1, "Введите название").max(120).optional(),
  categoryId: z.string().min(1).optional(),
  saleType: z.nativeEnum(SaleType).optional(),
  imageUrl: z.string().trim().max(300).nullish(),
  isActive: z.boolean().optional(),
  variants: z.array(variantSchema).min(1, "Добавьте хотя бы один вариант цены").optional(),
});

export const listProductsQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
  categoryId: z.string().optional(),
  saleType: z.nativeEnum(SaleType).optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === "true")),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
