import { create } from "zustand";

import type { PrinterProfile } from "./model";

// Which printers are attached is a property of one till/device, not the business — deliberately
// plain localStorage (same reasoning as themeStore's "pos-theme" key), never the shared Settings
// table other admins/devices would also read.
const STORAGE_KEY = "pos-printer-profiles";
// Phase 9 shipped with exactly one paired device under this key, no name/role/transport — read
// once, on first load after this file exists, and folded into a real profile so an already-
// paired cashier doesn't have to re-pair after this update. Never written to again.
const LEGACY_KEY = "pos-printer-device";

function loadStoredProfiles(): PrinterProfile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // fall through to legacy migration below
  }

  try {
    const legacyRaw = localStorage.getItem(LEGACY_KEY);
    if (!legacyRaw) return [];
    const legacy = JSON.parse(legacyRaw);
    if (typeof legacy?.vendorId !== "number" || typeof legacy?.productId !== "number") return [];
    const migrated: PrinterProfile = {
      id: crypto.randomUUID(),
      name: typeof legacy.name === "string" && legacy.name ? legacy.name : "Принтер",
      role: "register",
      transport: "webusb",
      paperWidthMm: 58,
      usb: { vendorId: legacy.vendorId, productId: legacy.productId },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify([migrated]));
    localStorage.removeItem(LEGACY_KEY);
    return [migrated];
  } catch {
    return [];
  }
}

type PrinterProfilesState = {
  profiles: PrinterProfile[];
  addProfile: (profile: PrinterProfile) => void;
  updateProfile: (id: string, patch: Partial<Omit<PrinterProfile, "id">>) => void;
  removeProfile: (id: string) => void;
};

/** All printers this device has been paired with — see PrinterProfile. `usePrintReceipt` picks
 * whichever profile currently has `role: "register"` (first match) for actual receipts; kitchen/
 * bar profiles can be paired and named today even though nothing prints to them yet. */
export const usePrinterProfilesStore = create<PrinterProfilesState>((set, get) => {
  function persist(profiles: PrinterProfile[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  }

  return {
    profiles: loadStoredProfiles(),
    addProfile: (profile) => {
      const next = [...get().profiles, profile];
      persist(next);
      set({ profiles: next });
    },
    updateProfile: (id, patch) => {
      const next = get().profiles.map((p) => (p.id === id ? { ...p, ...patch } : p));
      persist(next);
      set({ profiles: next });
    },
    removeProfile: (id) => {
      const next = get().profiles.filter((p) => p.id !== id);
      persist(next);
      set({ profiles: next });
    },
  };
});

/** The profile actual receipt printing (checkout / "Принять заказ" / reprint) uses. Plain
 * function, not a hook — usePrintReceipt.ts calls it from inside an async handler, not JSX. */
export function getRegisterProfile(): PrinterProfile | null {
  return usePrinterProfilesStore.getState().profiles.find((p) => p.role === "register") ?? null;
}
