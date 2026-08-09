import { previewDriver } from "./drivers/previewDriver";
import { webUsbXPrinterDriver } from "./drivers/webUsbXPrinterDriver";
import type { ReceiptPrinterDriver } from "./model";
import { usePairedPrinterStore } from "./webUsbPrinterStore";

/**
 * Every available driver, keyed by id. Adding a further one (a local print-agent, a second
 * printer brand, ...) means implementing ReceiptPrinterDriver in a new file under drivers/ and
 * adding one line here — not touching any of the checkout/reprint/history call sites.
 */
const DRIVERS: Record<string, ReceiptPrinterDriver> = {
  [previewDriver.id]: previewDriver,
  [webUsbXPrinterDriver.id]: webUsbXPrinterDriver,
};

/**
 * Once a printer has been paired (Settings → Принтер, see drivers/webUsbXPrinterDriver.ts's
 * pairPrinter()), every "Печать чека" call site — post-checkout, "Принять заказ", reprint from
 * history — automatically switches from the preview dialog to real USB printing, with zero
 * changes needed anywhere else (this is the whole point of the driver-interface seam; see
 * docs/RECEIPT_PRINTING.md). Falls back to the preview if WebUSB isn't supported in this
 * browser or nothing has been paired yet.
 */
export function getActiveDriver(): ReceiptPrinterDriver {
  const paired = usePairedPrinterStore.getState().device;
  if (paired && typeof navigator !== "undefined" && navigator.usb) {
    return webUsbXPrinterDriver;
  }
  return DRIVERS[previewDriver.id];
}
