import { z } from "zod";

const recipeLineSchema = z.object({
  ingredientId: z.string().min(1, "Выберите ингредиент"),
  quantity: z.coerce.number().positive("Количество должно быть больше нуля"),
});

export const setRecipeSchema = z
  .object({
    lines: z.array(recipeLineSchema).max(100),
  })
  .refine(
    (data) => new Set(data.lines.map((l) => l.ingredientId)).size === data.lines.length,
    { message: "Ингредиент не может повторяться в одном рецепте", path: ["lines"] },
  );

export const consumeRecipeSchema = z.object({
  quantity: z.coerce.number().positive("Количество должно быть больше нуля"),
  referenceId: z.string().trim().max(120).optional(),
});

export type RecipeLineInput = z.infer<typeof recipeLineSchema>;
export type SetRecipeInput = z.infer<typeof setRecipeSchema>;
export type ConsumeRecipeInput = z.infer<typeof consumeRecipeSchema>;
