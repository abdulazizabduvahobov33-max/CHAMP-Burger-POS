import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Введите название категории").max(80),
});

export const updateCategorySchema = createCategorySchema;

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
