import { buildEscPosBytes } from "../escpos";
import type { PrintResult, ReceiptDocument, ReceiptPrinterDriver } from "../model";
import { usePairedPrinterStore } from "../webUsbPrinterStore";

/**
 * Real ESC/POS printing over WebUSB — the XPrinter XP-58IIT connected via USB-C OTG to the
 * Android tablet running the POS. No install needed (unlike a local print-agent) and no manual
 * driver swap (unlike Windows, where the OS usually claims the USB device first) — Chrome for
 * Android hands a USB device straight to WebUSB once the user grants it once via pairPrinter().
 *
 * `print()` never prompts — WebUSB requires a user gesture for `requestDevice()` (pairing), but
 * reconnecting to an already-authorized device via `getDevices()` doesn't, so every checkout/
 * accept/reprint after the one-time pairing (see Settings → Принтер) is silent.
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

async function getPairedDevice(): Promise<USBDevice | null> {
  if (!navigator.usb) return null;
  const paired = usePairedPrinterStore.getState().device;
  if (!paired) return null;

  const devices = await navigator.usb.getDevices();
  return devices.find((d) => d.vendorId === paired.vendorId && d.productId === paired.productId) ?? null;
}

/** Must be called from a real user click/tap — WebUSB refuses `requestDevice()` otherwise. Shows
 * the browser's own device picker; no vendor/product filter, since guessing the XP-58IIT's exact
 * USB ids wrong would just make it not appear in the list at all. */
export async function pairPrinter(): Promise<{ ok: true; name: string } | { ok: false; error: string }> {
  if (!navigator.usb) return { ok: false, error: "webusb-unsupported" };
  try {
    const device = await navigator.usb.requestDevice({ filters: [] });
    const name = device.productName?.trim() || "USB принтер";
    usePairedPrinterStore.getState().setDevice({ vendorId: device.vendorId, productId: device.productId, name });
    return { ok: true, name };
  } catch (err) {
    // The user closing the picker without choosing anything throws too — not a real error.
    return { ok: false, error: err instanceof Error ? err.message : "cancelled" };
  }
}

export function forgetPrinter(): void {
  usePairedPrinterStore.getState().clearDevice();
}

export const webUsbXPrinterDriver: ReceiptPrinterDriver = {
  id: "webusb-xprinter",
  label: "XPrinter XP-58IIT (USB)",

  async print(doc: ReceiptDocument): Promise<PrintResult> {
    try {
      const device = await getPairedDevice();
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
