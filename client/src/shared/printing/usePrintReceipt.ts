import { useReceiptSettings } from "@/entities/setting/api";
import type { Sale } from "@/entities/sale/model";
import { buildReceiptDocument } from "./buildReceiptDocument";
import type { PrinterProfile, PrintResult, ReceiptDocument, ReceiptPrinterDriver } from "./model";
import { ensureConnected, reportPrintResult } from "./printerConnectionManager";
import { getActiveReceiptTarget } from "./printerRegistry";

/**
 * Everything printReceipt() below does besides fetching settings and building the document —
 * pulled out as a plain (non-hook) function so it's directly unit-testable: no React Query
 * provider, no component render, just driver/profile/doc in, PrintResult out. Never throws —
 * a failed pre-flight doesn't skip the real print attempt (print() has always resolved its own
 * device fresh, pre-flight is just a head start), and a failed print never does anything beyond
 * returning `{ ok: false }`. Nothing here touches a Sale — printing has no way to affect whether
 * one was created or what it contains, by construction.
 */
export async function printViaDriver(
  driver: ReceiptPrinterDriver,
  profile: PrinterProfile,
  doc: ReceiptDocument,
): Promise<PrintResult> {
  if (profile.transport !== "preview") {
    // Outcome intentionally ignored here — a failed pre-flight is not a reason to skip the real
    // print attempt below, which resolves its own device independently either way. This call's
    // only job is to give a slow-to-wake connection (WebBluetooth especially) a head start, and
    // to update the status line before the print's own result does.
    await ensureConnected(driver, profile);
  }

  const result = await driver.print(doc, profile);

  if (profile.transport !== "preview") {
    reportPrintResult(profile.id, result.ok);
  }

  return result;
}

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
    return printViaDriver(driver, profile, doc);
  }

  return { printReceipt, isReady: !isLoading && settings !== undefined };
}
