import { create } from "zustand";

import type { SaleType } from "@/entities/product/model";

export type CartLine = {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  imageUrl: string | null;
  unitPrice: string;
  saleType: SaleType;
  quantity: number;
};

type CartState = {
  lines: CartLine[];
  addItem: (item: Omit<CartLine, "quantity">) => void;
  incrementQuantity: (variantId: string) => void;
  decrementQuantity: (variantId: string) => void;
  /** For WEIGHT items: sets the line's quantity to exactly `quantityKg` instead of the ±1
   * stepping `addItem`/`incrementQuantity` do — re-entering the weight dialog for an item
   * already in the cart is meant to *replace* the weight, not add another kilogram's worth on
   * top of it. Creates the line if it isn't in the cart yet. */
  setWeightQuantity: (item: Omit<CartLine, "quantity">, quantityKg: number) => void;
  removeItem: (variantId: string) => void;
  clear: () => void;
};

/**
 * The cart is purely local, pre-checkout UI state — nothing here is persisted or fetched,
 * so it lives in Zustand (like authStore) rather than as React Query server state.
 */
export const useCartStore = create<CartState>((set) => ({
  lines: [],

  addItem: (item) =>
    set((state) => {
      const existing = state.lines.find((l) => l.variantId === item.variantId);
      if (existing) {
        return {
          lines: state.lines.map((l) =>
            l.variantId === item.variantId ? { ...l, quantity: l.quantity + 1 } : l,
          ),
        };
      }
      return { lines: [...state.lines, { ...item, quantity: 1 }] };
    }),

  incrementQuantity: (variantId) =>
    set((state) => ({
      lines: state.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: l.quantity + 1 } : l)),
    })),

  decrementQuantity: (variantId) =>
    set((state) => ({
      lines: state.lines
        .map((l) => (l.variantId === variantId ? { ...l, quantity: l.quantity - 1 } : l))
        .filter((l) => l.quantity > 0),
    })),

  setWeightQuantity: (item, quantityKg) =>
    set((state) => {
      const existing = state.lines.find((l) => l.variantId === item.variantId);
      if (existing) {
        return { lines: state.lines.map((l) => (l.variantId === item.variantId ? { ...l, quantity: quantityKg } : l)) };
      }
      return { lines: [...state.lines, { ...item, quantity: quantityKg }] };
    }),

  removeItem: (variantId) => set((state) => ({ lines: state.lines.filter((l) => l.variantId !== variantId) })),

  clear: () => set({ lines: [] }),
}));
