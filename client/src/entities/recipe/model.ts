import type { Unit } from "@/entities/ingredient/model";

export type RecipeLine = {
  id: string;
  ingredientId: string;
  ingredientName: string;
  unit: Unit;
  quantity: string;
};

export type RecipeLineInput = {
  ingredientId: string;
  quantity: number;
};
