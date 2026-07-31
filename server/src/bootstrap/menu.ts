import { SaleType } from "@prisma/client";

/**
 * The CHAMP Burger menu, categories, and product photos — single source of truth shared by
 * `prisma/seed.ts` (manual/local/Docker seeding) and `bootstrap/ensureMenuSeeded.ts` (automatic
 * first-run seeding, for hosts with no shell access to run the seed script by hand).
 *
 * `imageFile` names a file already committed under `server/src/uploads/` (see that folder) —
 * these are the actual menu photos, not placeholders, and are versioned in git specifically so
 * they survive a host with an ephemeral filesystem (a fresh deploy has no persisted uploads).
 */

export const CATEGORY = {
  BURGERS: "Бургеры",
  HOTDOGS: "Хот-доги и лаваш",
  OTHER: "Прочее",
  DRINKS: "Напитки",
} as const;

export type MenuItem = {
  name: string;
  category: string;
  saleType?: SaleType;
  imageFile?: string;
  variants: { label: string; price: number }[];
};

export const MENU: MenuItem[] = [
  // Бургеры
  {
    name: "Гамбургер",
    category: CATEGORY.BURGERS,
    imageFile: "49fb5e62-32fe-4351-9ee7-654ca84836cf.jpg",
    variants: [
      { label: "25 000", price: 25000 },
      { label: "35 000", price: 35000 },
    ],
  },
  {
    name: "Чизбургер",
    category: CATEGORY.BURGERS,
    imageFile: "f4c32840-b72e-4a77-8c6f-83d640001ead.jpg",
    variants: [
      { label: "28 000", price: 28000 },
      { label: "38 000", price: 38000 },
    ],
  },
  {
    name: "Chicken Burger",
    category: CATEGORY.BURGERS,
    imageFile: "43aec59d-28ce-470b-8274-c8f480463937.jpg",
    variants: [
      { label: "20 000", price: 20000 },
      { label: "28 000", price: 28000 },
    ],
  },
  {
    name: "Chicken Cheese",
    category: CATEGORY.BURGERS,
    imageFile: "e03d2117-c4cd-4a01-ba54-2582b3f14a82.jpg",
    variants: [
      { label: "23 000", price: 23000 },
      { label: "30 000", price: 30000 },
    ],
  },

  // Хот-доги и лаваш
  {
    name: "Kanada",
    category: CATEGORY.HOTDOGS,
    imageFile: "b1f1cf35-3bb2-4794-9396-ca582373dba9.jpg",
    variants: [
      { label: "15 000", price: 15000 },
      { label: "20 000", price: 20000 },
    ],
  },
  {
    name: "Salat",
    category: CATEGORY.HOTDOGS,
    imageFile: "23ae05fe-5dc7-4f48-b256-53ea3c783c6a.jpg",
    variants: [
      { label: "15 000", price: 15000 },
      { label: "20 000", price: 20000 },
      { label: "25 000", price: 25000 },
    ],
  },
  {
    name: "BBQ (Hot-dog)",
    category: CATEGORY.HOTDOGS,
    imageFile: "afd14271-d00e-48c9-b317-89e2f4fa8ef2.jpg",
    variants: [
      { label: "25 000", price: 25000 },
      { label: "35 000", price: 35000 },
    ],
  },
  {
    name: "Mangal",
    category: CATEGORY.HOTDOGS,
    imageFile: "c98e7dba-0b54-4454-96ee-a3784720c39b.jpg",
    variants: [
      { label: "25 000", price: 25000 },
      { label: "35 000", price: 35000 },
    ],
  },
  {
    name: "Lavash",
    category: CATEGORY.HOTDOGS,
    imageFile: "413a3f83-81cf-46f3-8da4-22c25f41bcc7.jpg",
    variants: [
      { label: "35 000", price: 35000 },
      { label: "38 000", price: 38000 },
    ],
  },
  {
    name: "Qazili Hot-dog",
    category: CATEGORY.HOTDOGS,
    imageFile: "268ffacb-27b2-42ef-bfae-3e6ef10d07b0.jpg",
    variants: [
      { label: "25 000", price: 25000 },
      { label: "30 000", price: 30000 },
      { label: "35 000", price: 35000 },
    ],
  },
  {
    name: "American Hot-dog",
    category: CATEGORY.HOTDOGS,
    imageFile: "2d208002-54cf-4395-9287-70cd1bfc4004.jpg",
    variants: [
      { label: "20 000", price: 20000 },
      { label: "25 000", price: 25000 },
    ],
  },
  {
    name: "Koralevskiy Hot-dog",
    category: CATEGORY.HOTDOGS,
    imageFile: "9c0210f8-544c-4f6d-9169-82c51c452b81.jpg",
    variants: [{ label: "25 000", price: 25000 }],
  },

  // Прочее
  {
    name: "Hagi",
    category: CATEGORY.OTHER,
    imageFile: "96d52632-5537-45e1-9881-6966f08c8617.jpg",
    variants: [{ label: "35 000", price: 35000 }],
  },
  {
    name: "Doner",
    category: CATEGORY.OTHER,
    imageFile: "04341b53-7e1f-4dd6-964b-fc0904076c19.jpg",
    variants: [
      { label: "30 000", price: 30000 },
      { label: "40 000", price: 40000 },
    ],
  },
  {
    name: "Kartoshka po derevenski",
    category: CATEGORY.OTHER,
    imageFile: "82a65dd7-3cc6-4869-8f40-c8378e20089d.jpg",
    variants: [{ label: "18 000", price: 18000 }],
  },
  {
    name: "Kefsi",
    category: CATEGORY.OTHER,
    saleType: SaleType.WEIGHT,
    imageFile: "b3c8a75d-9d07-45fe-9909-c0fd17b11fae.jpg",
    variants: [{ label: "100 000 / кг", price: 100000 }],
  },
  {
    name: "Fri",
    category: CATEGORY.OTHER,
    imageFile: "d835fa66-96d3-449e-816d-2928debe6fc3.jpg",
    variants: [{ label: "15 000", price: 15000 }],
  },
  {
    name: "Kofe",
    category: CATEGORY.DRINKS,
    imageFile: "5148d3be-1b38-4b1c-b4cb-0e6e01f0309b.jpg",
    variants: [{ label: "10 000", price: 10000 }],
  },
  {
    name: "Limon choy",
    category: CATEGORY.DRINKS,
    imageFile: "ee1f4ca4-9efb-4108-a846-27b45fd46c23.jpg",
    variants: [{ label: "8 000", price: 8000 }],
  },
];

export const DEFAULT_LOCATION_ID = "main-location";
export const DEFAULT_LOCATION_NAME = "Главный филиал";
