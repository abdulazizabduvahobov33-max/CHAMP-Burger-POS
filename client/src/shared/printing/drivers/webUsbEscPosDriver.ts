import { buildEscPosBytes } from "../escpos";
import type { PairResult, PrinterProfile, PrintResult, ReceiptDocument, ReceiptPrinterDriver } from "../model";

/**
 * Real ESC/POS printing over WebUSB — works for any USB thermal receipt printer (XPrinter or
 * otherwise) that shows up as a generic USB device with a bulk-OUT endpoint, which is effectively
 * all of them; nothing here is brand-specific beyond the codepage choice in escpos.ts. Supported
 * on desktop Chrome/Edge and Chrome for Android (via a USB-C/micro-USB OTG adapter) — not Safari
 * or Firefox, which don't implement WebUSB at all (see isSupported()).
 *
 * `print()` never prompts — WebUSB requires a user gesture for `requestDevice()` (pairing, via
 * the wizard), but reconnecting to an already-authorized device via `getDevices()` doesn't, so
 * every checkout/accept/reprint after the one-time pairing is silent.
 */

function findBulkOutEndpoint(device: USBDevice): { interfaceNumber: number; endpointNumber: number } | null {
  if (!device.configuration) return null;
  for (const iface of device.configuration.interfaces) {
    for (const ep of iface.alternate.endpoints) {
      if (ep.direction === "out" && ep.type === "bulk") {
        return { interfaceNumber: iface.interfaceNumber, endpointNumber: ep.endpointNumber };
      }
    }
  }
  return null;
}

async function findDeviceByIdentity(vendorId: number, productId: number): Promise<USBDevice | null> {
  if (!navigator.usb) return null;
  const devices = await navigator.usb.getDevices();
  return devices.find((d) => d.vendorId === vendorId && d.productId === productId) ?? null;
}

export const webUsbEscPosDriver: ReceiptPrinterDriver = {
  transport: "webusb",
  label: "USB (кабель или OTG-адаптер)",

  isSupported(): boolean {
    return typeof navigator !== "undefined" && Boolean(navigator.usb);
  },

  /** Shows the browser's own device picker; no vendor/product filter, since guessing a given
   * model's exact USB ids wrong would just make it not appear in the list at all. */
  async pair(): Promise<PairResult> {
    if (!navigator.usb) return { ok: false, error: "webusb-unsupported" };
    try {
      const device = await navigator.usb.requestDevice({ filters: [] });
      const name = device.productName?.trim() || "USB принтер";
      return { ok: true, name, identity: { usb: { vendorId: device.vendorId, productId: device.productId } } };
    } catch (err) {
      // The user closing the picker without choosing anything throws too — not a real error.
      return { ok: false, error: err instanceof Error ? err.message : "cancelled" };
    }
  },

  async print(doc: ReceiptDocument, profile: PrinterProfile): Promise<PrintResult> {
    if (!profile.usb) return { ok: false, error: "Профиль принтера повреждён — подключите принтер заново" };
    try {
      const device = await findDeviceByIdentity(profile.usb.vendorId, profile.usb.productId);
      if (!device) return { ok: false, error: "Принтер не подключён — откройте Настройки и подключите его заново" };

      if (!device.opened) await device.open();
      if (device.configuration === null) await device.selectConfiguration(1);

      const endpoint = findBulkOutEndpoint(device);
      if (!endpoint) return { ok: false, error: "У принтера не найден порт для печати (USB endpoint)" };

      await device.claimInterface(endpoint.interfaceNumber);

      const bytes = buildEscPosBytes(doc);
      const result = await device.transferOut(endpoint.endpointNumber, bytes);
      if (result.status !== "ok") return { ok: false, error: `Ошибка передачи данных на принтер (${result.status})` };

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Не удалось напечатать чек" };
    }
  },
};
