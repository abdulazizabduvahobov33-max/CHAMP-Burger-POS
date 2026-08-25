import { describe, expect, it, vi } from "vitest";

import type { PrinterProfile, ReceiptDocument, ReceiptPrinterDriver } from "./model";
import { printViaDriver } from "./usePrintReceipt";

const doc: ReceiptDocument = { paperWidthMm: 58, lines: [] };

function makeProfile(id: string): PrinterProfile {
  return { id, name: "Test printer", role: "register", transport: "webusb", paperWidthMm: 58, usb: { vendorId: 1, productId: 2 } };
}

/**
 * printViaDriver() is the exact function every automatic print call site (checkout accept, the
 * pending-orders panel, the "new order" popup) invokes as `void printReceipt(sale)` AFTER a sale
 * already exists — see PosCart.tsx/PendingOrdersPanel.tsx/OrderNotificationStack.tsx. It takes
 * only a driver/profile/document and returns a PrintResult; it has no reference to a Sale, no
 * import from the sales/checkout modules, and no way to call anything that creates one, deducts
 * stock, or retries the sale itself. These tests confirm the printing side of that contract:
 * a failure here is just a returned `{ ok: false }`, never a thrown error and never a second
 * attempt at sending the receipt bytes (which could double-print) — the actual "does this affect
 * a sale" guarantee is structural (nothing here can reach that code), not something to assert
 * with a mock.
 */
describe("printViaDriver", () => {
  it("resolves with ok:false instead of throwing when the driver fails to print", async () => {
    const driver: ReceiptPrinterDriver = {
      transport: "webusb",
      label: "Test",
      isSupported: () => true,
      pair: async () => ({ ok: false, error: "not used" }),
      checkAvailable: async () => true,
      print: async () => ({ ok: false, error: "printer unreachable" }),
    };

    const result = await printViaDriver(driver, makeProfile("fail-1"), doc);

    expect(result).toEqual({ ok: false, error: "printer unreachable" });
  });

  it("still gives the real print its own chance even when the pre-flight check fails", async () => {
    const print = vi.fn().mockResolvedValue({ ok: true });
    const driver: ReceiptPrinterDriver = {
      transport: "webusb",
      label: "Test",
      isSupported: () => true,
      pair: async () => ({ ok: false, error: "not used" }),
      checkAvailable: async () => false, // pre-flight reports "not reachable"
      print,
    };

    const result = await printViaDriver(driver, makeProfile("fail-2"), doc);

    expect(print).toHaveBeenCalledTimes(1);
    expect(result.ok).toBe(true);
  });

  it("calls print() exactly once — a failed print is never retried automatically (would risk a duplicate receipt)", async () => {
    const print = vi.fn().mockResolvedValue({ ok: false, error: "printer unreachable" });
    const driver: ReceiptPrinterDriver = {
      transport: "webusb",
      label: "Test",
      isSupported: () => true,
      pair: async () => ({ ok: false, error: "not used" }),
      checkAvailable: async () => true,
      print,
    };

    await printViaDriver(driver, makeProfile("fail-3"), doc);

    expect(print).toHaveBeenCalledTimes(1);
  });
});
