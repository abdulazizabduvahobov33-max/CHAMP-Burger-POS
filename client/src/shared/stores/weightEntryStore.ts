import { create } from "zustand";

/** Everything the weight-entry dialog needs about the line it's adding/editing — enough to build
 * a CartLine directly (see cartStore.ts's setWeightQuantity), so the dialog itself never needs a
 * live Product/ProductVariant reference, just this snapshot. */
export type WeightEntryTarget = {
  variantId: string;
  productId: string;
  productName: string;
  variantLabel: string;
  imageUrl: string | null;
  unitPrice: string;
  /** Pre-fills the input in grams when re-opening for a line already in the cart (editing);
   * omitted when adding a WEIGHT product to the cart for the first time. */
  initialGrams?: number;
};

type WeightEntryState = {
  target: WeightEntryTarget | null;
  open: (target: WeightEntryTarget) => void;
  close: () => void;
};

/**
 * Global, not per-component state, on purpose: both PosMenu (tapping a WEIGHT product card —
 * "add") and PosCart (tapping an existing weight line's edit button — "adjust") need to trigger
 * the exact same dialog, and they're siblings, not parent/child. One store + one mounted
 * `<WeightEntryDialog />` (see PosCart.tsx) means neither has to own or prop-drill the other's
 * dialog state — same "ephemeral UI state → its own tiny Zustand store" shape as toastStore/
 * printerStore elsewhere in shared/stores and shared/printing.
 */
export const useWeightEntryStore = create<WeightEntryState>((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null }),
}));
