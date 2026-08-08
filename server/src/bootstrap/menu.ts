import { SaleType } from "@prisma/client";

/**
 * The KRUNCH menu, categories, and product photos — single source of truth shared by
 * `prisma/seed.ts` (manual/local/Docker seeding) and `bootstrap/ensureMenuSeeded.ts` (automatic
 * first-run seeding, for hosts with no shell access to run the seed script by hand).
 *
 * `imageFile` names a file already committed under `server/src/uploads/` (see that folder) —
 * these are the actual menu photos, not placeholders, and are versioned in git specifically so
 * they survive a host with an ephemeral filesystem (a fresh deploy has no persisted uploads).
 * None of the KRUNCH items have one yet (real photos are a follow-up) — ProductImage already
 * shows a clean branded placeholder for any product with no imageFile, so this is a safe,
 * presentable interim state, not a bug.
 */

export const CATEGORY = {
  CHICKEN: "Курица",
  HOTDOGS: "Хот-доги",
  SHAURMA: "Шаурма",
  LAVASH: "Лаваш",
  SAMSA: "Самса",
  DRINKS: "Напитки",
  DESSERTS: "Десерты",
} as const;

export type MenuItem = {
  name: string;
  category: string;
  saleType?: SaleType;
  imageFile?: string;
  variants: { label: string; price: number }[];
};

// A classic soda's bottle/can size lineup — Cola, Fanta, and Pepsi are priced identically, so
// the variant list is shared instead of repeated three times.
const SODA_VARIANTS = [
  { label: "Бутылка", price: 5000 },
  { label: "0.5 л", price: 8000 },
  { label: "1 л", price: 12000 },
  { label: "1.5 л", price: 15000 },
];

export const MENU: MenuItem[] = [
  // Курица
  {
    name: "KFS",
    category: CATEGORY.CHICKEN,
    saleType: SaleType.WEIGHT,
    variants: [{ label: "1 кг", price: 85000 }],
  },

  // Хот-доги
  {
    name: "Хот-дог",
    category: CATEGORY.HOTDOGS,
    variants: [
      { label: "15 000", price: 15000 },
      { label: "18 000", price: 18000 },
      { label: "20 000", price: 20000 },
    ],
  },

  // Шаурма
  {
    name: "Шаурма",
    category: CATEGORY.SHAURMA,
    variants: [
      { label: "20 000", price: 20000 },
      { label: "25 000", price: 25000 },
      { label: "30 000", price: 30000 },
      { label: "35 000", price: 35000 },
    ],
  },

  // Лаваш
  {
    name: "Лаваш",
    category: CATEGORY.LAVASH,
    variants: [
      { label: "30 000", price: 30000 },
      { label: "35 000", price: 35000 },
      { label: "40 000", price: 40000 },
    ],
  },

  // Самса — each filling is its own product (same pattern as separate burger products in the
  // previous menu), since they're distinct items with a single price each, not size variants.
  {
    name: "Самса с говядиной",
    category: CATEGORY.SAMSA,
    variants: [{ label: "10 000", price: 10000 }],
  },
  {
    name: "Самса с бараниной",
    category: CATEGORY.SAMSA,
    variants: [{ label: "12 000", price: 12000 }],
  },
  {
    name: "Самса с картошкой",
    category: CATEGORY.SAMSA,
    variants: [{ label: "5 000", price: 5000 }],
  },

  // Напитки
  { name: "Cola", category: CATEGORY.DRINKS, variants: SODA_VARIANTS },
  { name: "Fanta", category: CATEGORY.DRINKS, variants: SODA_VARIANTS },
  { name: "Pepsi", category: CATEGORY.DRINKS, variants: SODA_VARIANTS },
  {
    name: "Вода без газа",
    category: CATEGORY.DRINKS,
    variants: [
      { label: "0.5 л", price: 3000 },
      { label: "1 л", price: 5000 },
    ],
  },
  {
    name: "Газированная вода",
    category: CATEGORY.DRINKS,
    variants: [{ label: "1 л", price: 5000 }],
  },
  {
    name: "Chortoq",
    category: CATEGORY.DRINKS,
    variants: [{ label: "15 000", price: 15000 }],
  },
  {
    name: "Мохито",
    category: CATEGORY.DRINKS,
    variants: [{ label: "15 000", price: 15000 }],
  },
  {
    name: "Коктейль",
    category: CATEGORY.DRINKS,
    variants: [{ label: "10 000", price: 10000 }],
  },
  {
    name: "Фруктовый коктейль",
    category: CATEGORY.DRINKS,
    variants: [{ label: "15 000", price: 15000 }],
  },

  // Десерты — scoop sizes are unit-priced; the by-weight bulk price is its own WEIGHT-typed
  // product (same split as Kefsi/KFS above), since saleType lives on the product, not the
  // variant, and mixing a per-scoop price list with a per-kg price under one saleType would be
  // ambiguous at checkout (is the seller entering a scoop count or a weight in kg?).
  {
    name: "Мороженое",
    category: CATEGORY.DESSERTS,
    variants: [
      { label: "5 000", price: 5000 },
      { label: "10 000", price: 10000 },
      { label: "15 000", price: 15000 },
    ],
  },
  {
    name: "Мороженое на вес",
    category: CATEGORY.DESSERTS,
    saleType: SaleType.WEIGHT,
    variants: [{ label: "1 кг", price: 60000 }],
  },
];

export const DEFAULT_LOCATION_ID = "main-location";
export const DEFAULT_LOCATION_NAME = "Главный филиал";
