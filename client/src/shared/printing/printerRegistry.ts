import { previewDriver } from "./drivers/previewDriver";
import { webBluetoothEscPosDriver } from "./drivers/webBluetoothEscPosDriver";
import { webUsbEscPosDriver } from "./drivers/webUsbEscPosDriver";
import type { PrinterProfile, PrinterTransport, ReceiptPrinterDriver } from "./model";
import { getRegisterProfile } from "./printerProfilesStore";

/**
 * Every available driver, keyed by transport. Adding a further one (a local print-agent, a
 * different transport entirely) means implementing ReceiptPrinterDriver in a new file under
 * drivers/ and adding one line here — not touching any of the checkout/reprint/history call
 * sites, printerProfilesStore.ts, or the setup wizard's step logic.
 */
const DRIVERS: Record<PrinterTransport, ReceiptPrinterDriver> = {
  webusb: webUsbEscPosDriver,
  webbluetooth: webBluetoothEscPosDriver,
  preview: previewDriver,
};

export function getDriver(transport: PrinterTransport): ReceiptPrinterDriver {
  return DRIVERS[transport];
}

/** Real, pairable transports — what the wizard's first step offers. Excludes "preview", which is
 * never a user choice (see previewDriver.ts). */
export function getPairableDrivers(): ReceiptPrinterDriver[] {
  return [webUsbEscPosDriver, webBluetoothEscPosDriver];
}

const PREVIEW_PROFILE: PrinterProfile = {
  id: "preview",
  name: "Предпросмотр",
  role: "register",
  transport: "preview",
  paperWidthMm: 58,
};

/**
 * What every "Печать чека" call site actually uses — see usePrintReceipt.ts. Falls back to the
 * preview dialog whenever no profile has been paired for the "register" role yet, exactly like
 * before this device supported multiple named printers.
 */
export function getActiveReceiptTarget(): { driver: ReceiptPrinterDriver; profile: PrinterProfile } {
  const profile = getRegisterProfile();
  if (profile) return { driver: DRIVERS[profile.transport], profile };
  return { driver: previewDriver, profile: PREVIEW_PROFILE };
}
