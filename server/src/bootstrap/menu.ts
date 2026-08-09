import { SaleType } from "@prisma/client";

/**
 * The Sharof KFS menu, categories, and product photos — single source of truth shared by
 * `prisma/seed.ts` (manual/local/Docker seeding) and `bootstrap/ensureMenuSeeded.ts` (automatic
 * first-run seeding, for hosts with no shell access to run the seed script by hand).
 *
 * `imageFile` names a file already committed under `server/src/uploads/` (see that folder) —
 * versioned in git specifically so it survives a host with an ephemeral filesystem (a fresh
 * deploy has no persisted uploads). Every Sharof KFS item currently points at a temporary,
 * legally-licensed stock photo (no third-party brand/logo visible in any shot) chosen to match
 * the dish — the client will swap these for their own photography later via the admin panel's
 * per-product photo upload; nothing else needs to change when that happens.
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
    imageFile: "a9e92b01-a635-407e-817c-abe53e75a1af.jpg",
    variants: [{ label: "1 кг", price: 85000 }],
  },

  // Хот-доги
  {
    name: "Хот-дог",
    category: CATEGORY.HOTDOGS,
    imageFile: "7fde67a2-412f-4a59-89dd-bdf7d55eba71.jpg",
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
    imageFile: "d7d51613-1e9b-4b66-a6ae-3921d5ecfa96.jpg",
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
    imageFile: "34c91837-6514-4899-a493-088a13fa0fc1.jpg",
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
    imageFile: "cb9a41d0-b9a0-4146-baeb-f0ddf33d9dac.jpg",
    variants: [{ label: "10 000", price: 10000 }],
  },
  {
    name: "Самса с бараниной",
    category: CATEGORY.SAMSA,
    imageFile: "30698c88-01c0-4584-89da-e6ef333eb7b4.jpg",
    variants: [{ label: "12 000", price: 12000 }],
  },
  {
    name: "Самса с картошкой",
    category: CATEGORY.SAMSA,
    imageFile: "7a62557f-31dd-4959-89b4-d1a141b59e58.jpg",
    variants: [{ label: "5 000", price: 5000 }],
  },

  // Напитки
  { name: "Cola", category: CATEGORY.DRINKS, imageFile: "5615f450-6eff-4ba7-86e4-e75c44e0a286.jpg", variants: SODA_VARIANTS },
  { name: "Fanta", category: CATEGORY.DRINKS, imageFile: "5523a63f-488b-4f23-8abc-63fb7e4e1b38.jpg", variants: SODA_VARIANTS },
  { name: "Pepsi", category: CATEGORY.DRINKS, imageFile: "8da2e0d3-8579-4e66-b4cb-ff43aa786830.jpg", variants: SODA_VARIANTS },
  {
    name: "Вода без газа",
    category: CATEGORY.DRINKS,
    imageFile: "93338e3d-48a4-4e05-b8ab-265af50c2001.jpg",
    variants: [
      { label: "0.5 л", price: 3000 },
      { label: "1 л", price: 5000 },
    ],
  },
  {
    name: "Газированная вода",
    category: CATEGORY.DRINKS,
    imageFile: "3581ad3d-5171-4a03-b570-2e664803488a.jpg",
    variants: [{ label: "1 л", price: 5000 }],
  },
  {
    name: "Chortoq",
    category: CATEGORY.DRINKS,
    imageFile: "a1c508aa-5e12-4fa0-a252-741caec9316c.jpg",
    variants: [{ label: "15 000", price: 15000 }],
  },
  {
    name: "Мохито",
    category: CATEGORY.DRINKS,
    imageFile: "599ea818-6128-4c10-a81d-d4f3758872dc.jpg",
    variants: [{ label: "15 000", price: 15000 }],
  },
  {
    name: "Коктейль",
    category: CATEGORY.DRINKS,
    imageFile: "a4eb5184-fa5f-4061-92d1-0e21a420249d.jpg",
    variants: [{ label: "10 000", price: 10000 }],
  },
  {
    name: "Фруктовый коктейль",
    category: CATEGORY.DRINKS,
    imageFile: "ca0ff521-49da-4b37-abbc-a43941a1e152.jpg",
    variants: [{ label: "15 000", price: 15000 }],
  },

  // Десерты — scoop sizes are unit-priced; the by-weight bulk price is its own WEIGHT-typed
  // product (same split as Kefsi/KFS above), since saleType lives on the product, not the
  // variant, and mixing a per-scoop price list with a per-kg price under one saleType would be
  // ambiguous at checkout (is the seller entering a scoop count or a weight in kg?).
  {
    name: "Мороженое",
    category: CATEGORY.DESSERTS,
    imageFile: "25a725e6-2fe0-405f-9240-74f61905383f.jpg",
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
    imageFile: "1c4e1bd5-02e9-43aa-b129-114f23817be8.jpg",
    variants: [{ label: "1 кг", price: 60000 }],
  },
];

export const DEFAULT_LOCATION_ID = "main-location";
export const DEFAULT_LOCATION_NAME = "Главный филиал";
