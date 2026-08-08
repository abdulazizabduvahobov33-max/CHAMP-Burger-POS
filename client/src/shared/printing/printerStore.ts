import { create } from "zustand";

import type { ReceiptDocument } from "./model";

type PrinterState = {
  previewDocument: ReceiptDocument | null;
  showPreview: (doc: ReceiptDocument) => void;
  closePreview: () => void;
};

/** Backs the preview driver (drivers/previewDriver.ts) — same "plain-function API callable
 * outside React" shape as toastStore, since a driver's print() isn't a component and has no
 * hook context of its own to push UI state through. */
export const usePrinterStore = create<PrinterState>((set) => ({
  previewDocument: null,
  showPreview: (doc) => set({ previewDocument: doc }),
  closePreview: () => set({ previewDocument: null }),
}));
