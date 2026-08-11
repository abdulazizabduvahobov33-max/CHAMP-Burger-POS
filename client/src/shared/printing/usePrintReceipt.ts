import { useReceiptSettings } from "@/entities/setting/api";
import type { Sale } from "@/entities/sale/model";
import { buildReceiptDocument } from "./buildReceiptDocument";
import type { PrintResult } from "./model";
import { getActiveReceiptTarget } from "./printerRegistry";

/**
 * The one hook every "Печать чека" button uses — post-checkout, "reprint last", and order
 * history all call the same `printReceipt(sale)`. Fetches the receipt-relevant company settings
 * itself (cached by React Query, so a rapid reprint doesn't re-fetch), builds the printer-
 * agnostic document at whichever paper width the active "register" printer profile is set to
 * (58mm unless the wizard was told otherwise), and hands it to whichever driver that profile's
 * transport maps to.
 */
export function usePrintReceipt() {
  const { data: settings, isLoading } = useReceiptSettings();

  async function printReceipt(sale: Sale): Promise<PrintResult> {
    if (!settings) return { ok: false, error: "not-ready" };
    const { driver, profile } = getActiveReceiptTarget();
    const doc = buildReceiptDocument(sale, settings, profile.paperWidthMm);
    return driver.print(doc, profile);
  }

  return { printReceipt, isReady: !isLoading && settings !== undefined };
}
