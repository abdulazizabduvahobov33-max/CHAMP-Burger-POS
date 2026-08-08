/**
 * Printer-agnostic description of a receipt — the one thing every driver (today's preview,
 * tomorrow's WebUSB/local-agent ESC/POS driver) agrees on. Nothing that BUILDS a receipt
 * (checkout, reprint, order history) needs to know which physical printer is attached, and
 * nothing that PRINTS one needs to know how a Sale is shaped — this document is the seam
 * between the two. See docs/RECEIPT_PRINTING.md for the full architecture write-up.
 */

export type ReceiptAlign = "left" | "center" | "right";

export type ReceiptLine =
  /** A single line of text. */
  | { type: "text"; value: string; align?: ReceiptAlign; bold?: boolean; size?: "normal" | "large" }
  /** A label/value pair on one line, label left-aligned and value right-aligned (item × qty ...
   * price, ИТОГО ... сумма) — thermal receipts are built almost entirely out of these. */
  | { type: "row"; left: string; right: string; bold?: boolean }
  /** A dashed horizontal divider, full paper width. */
  | { type: "rule" }
  /** A blank line. */
  | { type: "spacer" }
  /** Paper cut — the last line of every document; a driver with no physical cutter just ignores it. */
  | { type: "cut" };

export type ReceiptDocument = {
  /** Thermal paper width this was laid out for. Lives on the document (not hardcoded into a
   * driver) so a future 80mm printer is a config value, not a code change — see
   * buildReceiptDocument()'s `paperWidthMm` parameter. */
  paperWidthMm: 58 | 80;
  lines: ReceiptLine[];
};

export type PrintResult = { ok: true } | { ok: false; error: string };

/**
 * What every printer integration implements. The XPrinter XP-58IIT (or any future model/brand)
 * is wired in by adding ONE new file that satisfies this interface and registering it in
 * printerRegistry.ts — nothing that calls print() changes.
 */
export interface ReceiptPrinterDriver {
  readonly id: string;
  /** Shown in any future "choose your printer" UI. */
  readonly label: string;
  print(doc: ReceiptDocument): Promise<PrintResult>;
}
