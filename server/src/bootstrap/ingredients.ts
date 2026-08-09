import { Unit } from "@prisma/client";

/**
 * The baseline ingredient set every Sharof KFS location needs on day one — same role as `menu.ts`
 * for products: single source of truth shared by `prisma/seed.ts` (manual/local/Docker seeding)
 * and `bootstrap/ensureIngredientsSeeded.ts` (automatic first-run seeding, for hosts with no
 * shell access to run the seed script by hand).
 *
 * `minQuantity` values are starting points picked for a typical single-location fast-food kitchen
 * (bottled drinks restocked by the case, meat/produce by the kilo) — an admin can change any of
 * them after the fact via the ingredient directory; this list only decides what exists initially,
 * not what stays fixed.
 */

export type SeedIngredient = {
  name: string;
  unit: Unit;
  minQuantity: number;
};

export const BASELINE_INGREDIENTS: SeedIngredient[] = [
  { name: "Lavash hamir", unit: Unit.PIECE, minQuantity: 30 },
  { name: "Non", unit: Unit.PIECE, minQuantity: 20 },
  { name: "Go'sht", unit: Unit.KG, minQuantity: 5 },
  { name: "Tovuq", unit: Unit.KG, minQuantity: 5 },
  { name: "Sir", unit: Unit.PIECE, minQuantity: 10 },
  { name: "Kartoshka", unit: Unit.KG, minQuantity: 10 },
  { name: "Coca-Cola 0.5L", unit: Unit.PIECE, minQuantity: 24 },
  { name: "Coca-Cola 1L", unit: Unit.PIECE, minQuantity: 12 },
  { name: "Pepsi 0.5L", unit: Unit.PIECE, minQuantity: 24 },
  { name: "Pepsi 1L", unit: Unit.PIECE, minQuantity: 12 },
  { name: "Fanta 0.5L", unit: Unit.PIECE, minQuantity: 24 },
  { name: "Fanta 1L", unit: Unit.PIECE, minQuantity: 12 },
  { name: "Sprite 0.5L", unit: Unit.PIECE, minQuantity: 24 },
  { name: "Sprite 1L", unit: Unit.PIECE, minQuantity: 12 },
];
