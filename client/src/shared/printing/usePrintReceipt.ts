import { useReceiptSettings } from "@/entities/setting/api";
import type { Sale } from "@/entities/sale/model";
import { buildReceiptDocument } from "./buildReceiptDocument";
import type { PrintResult } from "./model";
import { getActiveDriver } from "./printerRegistry";

/**
 * The one hook every "Печать чека" button uses — post-checkout, "reprint last", and order
 * history all call the same `printReceipt(sale)`. Fetches the receipt-relevant company settings
 * itself (cached by React Query, so a rapid reprint doesn't re-fetch), builds the printer-
 * agnostic document, and hands it to whichever driver is currently active.
 */
export function usePrintReceipt() {
  const { data: settings, isLoading } = useReceiptSettings();

  async function printReceipt(sale: Sale): Promise<PrintResult> {
    if (!settings) return { ok: false, error: "not-ready" };
    const doc = buildReceiptDocument(sale, settings);
    return getActiveDriver().print(doc);
  }

  return { printReceipt, isReady: !isLoading && settings !== undefined };
}
