import { usePrinterStore } from "../printerStore";
import type { PairResult, PrintResult, ReceiptDocument, ReceiptPrinterDriver } from "../model";

/**
 * Stand-in for a real ESC/POS driver. Instead of sending anything to hardware, it shows exactly
 * what would be printed via <ReceiptPreviewDialog /> (mounted once in App.tsx). This is the
 * fallback printerRegistry.ts reaches for whenever no real printer profile is paired for the
 * "register" role — a fresh install prints nothing to hardware but never fails to "print" either.
 *
 * `pair()` exists only so this satisfies the same ReceiptPrinterDriver interface every real
 * driver does — nothing in the printer wizard actually offers "Предпросмотр" as a transport
 * choice, so it's never called in practice, but printerRegistry.ts can treat every driver
 * uniformly (including this one) without a special case.
 */
export const previewDriver: ReceiptPrinterDriver = {
  transport: "preview",
  label: "Предпросмотр",

  isSupported(): boolean {
    return true;
  },

  async pair(): Promise<PairResult> {
    return { ok: true, name: "Предпросмотр", identity: {} };
  },

  async print(doc: ReceiptDocument): Promise<PrintResult> {
    usePrinterStore.getState().showPreview(doc);
    return { ok: true };
  },
};
