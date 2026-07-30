import { create } from "zustand";

export type CartLine = {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  imageUrl: string | null;
  unitPrice: string;
  quantity: number;
};

type CartState = {
  lines: CartLine[];
  addItem: (item: Omit<CartLine, "quantity">) => void;
  incrementQuantity: (variantId: string) => void;
  decrementQuantity: (variantId: string) => void;
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

  removeItem: (variantId) => set((state) => ({ lines: state.lines.filter((l) => l.variantId !== variantId) })),

  clear: () => set({ lines: [] }),
}));
