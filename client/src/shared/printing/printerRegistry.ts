import { previewDriver } from "./drivers/previewDriver";
import type { ReceiptPrinterDriver } from "./model";

/**
 * Every available driver, keyed by id. Adding real hardware support later (WebUSB, a local
 * print-agent, ...) means implementing ReceiptPrinterDriver in a new file under drivers/ and
 * adding one line here — not touching any of the checkout/reprint/history call sites.
 *
 * Once there's more than one real driver, `getActiveDriver` is also where per-device printer
 * choice belongs (read from a small localStorage-backed store, deliberately NOT the shared
 * Settings table — which printer is attached is a property of one till/computer, not the
 * business, so it must never be shared across every device the way cafe_name or tax_percent
 * are). Not built yet because a driver-picker UI with exactly one option to pick is just
 * clutter — see PRINTING.md.
 */
const DRIVERS: Record<string, ReceiptPrinterDriver> = {
  [previewDriver.id]: previewDriver,
};

export function getActiveDriver(): ReceiptPrinterDriver {
  return DRIVERS[previewDriver.id];
}
