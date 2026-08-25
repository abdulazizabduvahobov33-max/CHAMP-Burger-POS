import { buildEscPosBytes } from "../escpos";
import type { PairResult, PrinterProfile, PrintResult, ReceiptDocument, ReceiptPrinterDriver } from "../model";

/**
 * Real ESC/POS printing over Web Bluetooth — for printers with no USB port in reach (or a phone/
 * tablet with no OTG adapter), most cheap BLE thermal printers expose one of a handful of GATT
 * service/characteristic UUID pairs regardless of brand. Unlike WebUSB (a generic "find the bulk
 * endpoint" search that works the same way on every device), Bluetooth GATT has no such generic
 * discovery — Chrome only allows a page to touch services it declared up front in
 * `optionalServices`, so this tries each entry in KNOWN_PROFILES in turn and uses the first one
 * that actually resolves a writable characteristic on the connected device.
 *
 * If a real unit turns out to use neither known profile, that's the first thing to extend — add
 * its service/characteristic UUID pair to KNOWN_PROFILES (from the printer's own SDK/manual or by
 * inspecting it with a BLE scanner app) and everything else keeps working unchanged. Same spirit
 * as escpos.ts's CODEPAGE_TABLE constant: a documented, adjustable guess, not a guarantee.
 */

type ServiceProfile = { service: string; characteristic: string };

const KNOWN_PROFILES: ServiceProfile[] = [
  // The single most common "generic BLE thermal printer" GATT profile — used by a large share of
  // unbranded/OEM 58mm and 80mm printer modules sold under many different storefront names.
  { service: "000018f0-0000-1000-8000-00805f9b34fb", characteristic: "00002af1-0000-1000-8000-00805f9b34fb" },
  // Nordic UART Service — some printers use a UART-bridge BLE module instead of a printer-
  // specific profile; this is that bridge's standard write characteristic.
  { service: "6e400001-b5a3-f393-e0a9-e50e24dcca9e", characteristic: "6e400002-b5a3-f393-e0a9-e50e24dcca9e" },
];

const ALL_SERVICE_UUIDS = KNOWN_PROFILES.map((p) => p.service);

// A GATT characteristic write has a payload ceiling (the negotiated ATT MTU minus a few header
// bytes — often as low as ~20 bytes on older stacks, rarely more than a few hundred). A full
// receipt is easily 500+ bytes, so it's sent in small chunks with a short pause between them
// rather than one writeValue() call, which real hardware will otherwise silently truncate.
const CHUNK_SIZE = 100;
const CHUNK_DELAY_MS = 20;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function findCharacteristic(server: BluetoothRemoteGATTServer): Promise<BluetoothRemoteGATTCharacteristic | null> {
  for (const profile of KNOWN_PROFILES) {
    try {
      const service = await server.getPrimaryService(profile.service);
      const characteristic = await service.getCharacteristic(profile.characteristic);
      return characteristic;
    } catch {
      // This device doesn't expose this particular profile — try the next candidate.
    }
  }
  return null;
}

async function findPairedDevice(deviceId: string): Promise<BluetoothDevice | null> {
  if (!navigator.bluetooth?.getDevices) return null;
  const devices = await navigator.bluetooth.getDevices();
  return devices.find((d) => d.id === deviceId) ?? null;
}

export const webBluetoothEscPosDriver: ReceiptPrinterDriver = {
  transport: "webbluetooth",
  label: "Bluetooth",

  isSupported(): boolean {
    return typeof navigator !== "undefined" && Boolean(navigator.bluetooth);
  },

  async pair(): Promise<PairResult> {
    if (!navigator.bluetooth) return { ok: false, error: "webbluetooth-unsupported" };
    try {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ALL_SERVICE_UUIDS,
      });
      const name = device.name?.trim() || "Bluetooth принтер";
      return { ok: true, name, identity: { bluetooth: { deviceId: device.id } } };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "cancelled" };
    }
  },

  /** Unlike WebUSB, Bluetooth has no "is it there" signal cheaper than actually connecting the
   * GATT server — `device.gatt.connected` only tells us about a connection already established
   * in this page session, so a cold check still has to attempt connect(). This IS the reconnect:
   * printerConnectionManager.ts calls it before a print specifically so that a real receipt send
   * a moment later finds an already-connected server instead of paying this cost inline. */
  async checkAvailable(profile: PrinterProfile): Promise<boolean> {
    if (!profile.bluetooth) return false;
    const device = await findPairedDevice(profile.bluetooth.deviceId);
    if (!device?.gatt) return false;
    if (device.gatt.connected) return true;
    try {
      await device.gatt.connect();
      return true;
    } catch {
      return false;
    }
  },

  async print(doc: ReceiptDocument, profile: PrinterProfile): Promise<PrintResult> {
    if (!profile.bluetooth) return { ok: false, error: "Профиль принтера повреждён — подключите принтер заново" };
    try {
      const device = await findPairedDevice(profile.bluetooth.deviceId);
      if (!device?.gatt) {
        return { ok: false, error: "Принтер не подключён — откройте Настройки и подключите его заново" };
      }

      const server = device.gatt.connected ? device.gatt : await device.gatt.connect();
      const characteristic = await findCharacteristic(server);
      if (!characteristic) {
        return { ok: false, error: "Не удалось найти канал печати на этом Bluetooth-устройстве" };
      }

      const bytes = buildEscPosBytes(doc);
      for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
        await characteristic.writeValue(bytes.slice(offset, offset + CHUNK_SIZE));
        if (offset + CHUNK_SIZE < bytes.length) await sleep(CHUNK_DELAY_MS);
      }

      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : "Не удалось напечатать чек" };
    }
  },
};
