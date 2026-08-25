/**
 * Printer-agnostic description of a receipt — the one thing every driver (preview, WebUSB,
 * WebBluetooth, tomorrow's local-agent driver) agrees on. Nothing that BUILDS a receipt
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
   * driver) so an 80mm printer is a config value (see PrinterProfile.paperWidthMm), not a code
   * change — see buildReceiptDocument()'s `paperWidthMm` parameter. */
  paperWidthMm: 58 | 80;
  lines: ReceiptLine[];
};

export type PrintResult = { ok: true } | { ok: false; error: string };

/**
 * How a printer is physically reached. Adding a third (say, a local network print-agent a
 * future client runs on their own machine) means: a new value here, a new driver file
 * implementing ReceiptPrinterDriver, one line in printerRegistry.ts's DRIVERS map, and one entry
 * in the wizard's transport-choice step — nothing else in the app changes.
 */
export type PrinterTransport = "webusb" | "webbluetooth" | "preview";

/** What a printer is used for. Only "register" is actually wired to a print call site today
 * (checkout / "Принять заказ" / reprint) — kitchen and bar exist now purely so a location can
 * pair and label a second or third printer ahead of the feature that routes tickets to them,
 * without a data-model change once that feature exists. */
export type PrinterRole = "register" | "kitchen" | "bar";

/** Identifies one physical printer this device has been paired with, persisted locally (see
 * printerProfilesStore.ts — a printer is a property of the till it's plugged into, not the
 * business). Exactly one of `usb`/`bluetooth` is set, matching `transport`. */
export type PrinterProfile = {
  id: string;
  name: string;
  role: PrinterRole;
  transport: PrinterTransport;
  paperWidthMm: 58 | 80;
  usb?: { vendorId: number; productId: number };
  bluetooth?: { deviceId: string };
};

export type PrinterIdentity = Pick<PrinterProfile, "usb" | "bluetooth">;

export type PairResult = { ok: true; name: string; identity: PrinterIdentity } | { ok: false; error: string };

/**
 * What every printer integration implements. A brand-new transport (or a specific model that
 * needs different handling) is wired in by adding ONE new file that satisfies this interface and
 * registering it in printerRegistry.ts — nothing that calls print() changes, and the setup
 * wizard (widgets/printer-wizard) drives any driver through the same three calls.
 */
export interface ReceiptPrinterDriver {
  readonly transport: PrinterTransport;
  /** Shown in the wizard's connection-type step. */
  readonly label: string;
  /** Whether this transport's browser API exists at all on this device — a wizard step hides
   * (rather than shows disabled) an option that could never work here. */
  isSupported(): boolean;
  /** Must be called from a real user click/tap — every one of these browser APIs requires a user
   * gesture for its device picker. Resolves once the user has chosen (or cancelled) a device. */
  pair(): Promise<PairResult>;
  print(doc: ReceiptDocument, profile: PrinterProfile): Promise<PrintResult>;
  /** Optional lightweight "is this already-paired printer reachable right now" probe — used by
   * printerConnectionManager.ts to drive the connection status shown in Settings and to warm the
   * connection just before a print, without sending an actual receipt. Never shows a device
   * picker — only checks/reconnects to a device the browser has already authorized, the same way
   * print() itself resolves a device. A driver that doesn't implement this (previewDriver, which
   * is never really "disconnected") is treated as always available. */
  checkAvailable?(profile: PrinterProfile): Promise<boolean>;
}
