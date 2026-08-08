import { usePrinterStore } from "../printerStore";
import type { PrintResult, ReceiptDocument, ReceiptPrinterDriver } from "../model";

/**
 * Stand-in for a real ESC/POS driver. Instead of sending anything to hardware, it shows exactly
 * what would be printed via <ReceiptPreviewDialog /> (mounted once in App.tsx). This is the
 * default — and right now the ONLY — driver; see printerRegistry.ts.
 *
 * Why start here instead of wiring up the real XPrinter XP-58IIT right away: this repo's backend
 * runs on a cloud host (Render) while the printer is physically attached to whichever computer
 * the cashier is using, so printing has to be initiated from the browser/device, not the server.
 * The three realistic ways to do that — WebUSB (Chromium-only, and Windows usually needs a
 * manual driver swap before a USB device is WebUSB-reachable at all), the browser's native
 * print dialog via window.print() (works everywhere, but only if the OS already has the printer
 * installed, and needs a manual click every time), and a small local "print agent" service the
 * page talks to over localhost (full ESC/POS control, works with any connection type, the
 * pattern real commercial POS systems use) — all live entirely on the client and are equally
 * capable of implementing ReceiptPrinterDriver. None of that changes buildReceiptDocument(),
 * the checkout/reprint/history call sites, or this file's neighbors; a real driver is a new file
 * plus one line in printerRegistry.ts.
 */
export const previewDriver: ReceiptPrinterDriver = {
  id: "preview",
  label: "Предпросмотр (принтер не подключён)",
  async print(doc: ReceiptDocument): Promise<PrintResult> {
    usePrinterStore.getState().showPreview(doc);
    return { ok: true };
  },
};
