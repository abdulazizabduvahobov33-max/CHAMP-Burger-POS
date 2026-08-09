import { create } from "zustand";

// Which printer is attached is a property of one till/device, not the business — deliberately
// plain localStorage (same reasoning as themeStore's "pos-theme" key), never the shared Settings
// table other admins/devices would also read.
const STORAGE_KEY = "pos-printer-device";

export type PairedPrinterDevice = { vendorId: number; productId: number; name: string };

function loadStored(): PairedPrinterDevice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.vendorId === "number" && typeof parsed?.productId === "number") return parsed;
    return null;
  } catch {
    return null;
  }
}

type PairedPrinterState = {
  device: PairedPrinterDevice | null;
  setDevice: (device: PairedPrinterDevice) => void;
  clearDevice: () => void;
};

/** Remembers which USB printer was paired via `pairPrinter()` (webUsbXPrinterDriver.ts) so
 * printerRegistry.ts can pick the real driver over the preview one on every later print call —
 * without this, WebUSB's own per-origin permission (which *does* persist in Chrome) would still
 * let us reconnect, but we'd have no signal to prefer the real driver over the preview one. */
export const usePairedPrinterStore = create<PairedPrinterState>((set) => ({
  device: loadStored(),
  setDevice: (device) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(device));
    set({ device });
  },
  clearDevice: () => {
    localStorage.removeItem(STORAGE_KEY);
    set({ device: null });
  },
}));
