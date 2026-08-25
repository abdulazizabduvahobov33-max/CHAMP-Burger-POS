import { create } from "zustand";

import type { PrinterProfile, ReceiptPrinterDriver } from "./model";

export type PrinterConnectionState = "connected" | "connecting" | "disconnected";

// One reasonable pause between the two probe attempts a single ensureConnected() call makes —
// long enough that a printer waking from a momentary BLE hiccup or USB re-enumeration has a real
// chance to be ready on the second try, short enough that a cashier never perceives it as a
// hang. There is deliberately no escalating/exponential backoff and no state that persists
// between separate ensureConnected() calls — each call does at most two probes and then stops;
// nothing here ever re-schedules itself, which is what keeps this from becoming a reconnect
// loop. The next real trigger (a print's own pre-flight, the tab becoming visible again, the
// device coming back online — see PrinterAutoReconnectProvider.tsx) is what calls it again.
const RETRY_DELAY_MS = 1500;

type ConnectionStoreState = {
  byProfileId: Record<string, PrinterConnectionState>;
  setState: (profileId: string, state: PrinterConnectionState) => void;
};

// Live, per-device UI state only ("is the paired printer reachable right now") — not persisted,
// rebuilt fresh every page load exactly like the printer connection itself has to be. The
// *identity* of which printer is paired lives in printerProfilesStore.ts; this is purely
// ephemeral reachability state layered on top of it.
const useConnectionStore = create<ConnectionStoreState>((set) => ({
  byProfileId: {},
  setState: (profileId, state) =>
    set((s) => (s.byProfileId[profileId] === state ? s : { byProfileId: { ...s.byProfileId, [profileId]: state } })),
}));

/** Live connection status for one printer profile, for the Settings status line — "disconnected"
 * until the first ensureConnected()/reportPrintResult() call for that profile settles. */
export function usePrinterConnectionState(profileId: string | undefined): PrinterConnectionState {
  return useConnectionStore((s) => (profileId ? (s.byProfileId[profileId] ?? "disconnected") : "disconnected"));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Exactly one in-flight attempt per profile at a time. A second caller for the same profile
// (a concurrent print's pre-flight, a visibilitychange firing mid-attempt, ...) awaits this same
// promise instead of starting its own — this is what actually prevents two overlapping
// WebBluetooth gatt.connect() calls (or two overlapping WebUSB lookups) racing each other
// against the same physical device.
const inFlight = new Map<string, Promise<boolean>>();

/**
 * Makes sure `profile` is reachable. Reuses driver.checkAvailable() (see model.ts) — a driver
 * that doesn't implement one (the preview driver) is treated as always available, since it's
 * never really "disconnected". Tries once, and if that fails, once more after a short pause —
 * never more than that per call; see RETRY_DELAY_MS above for why that's not a loop.
 */
export function ensureConnected(driver: ReceiptPrinterDriver, profile: PrinterProfile): Promise<boolean> {
  const existing = inFlight.get(profile.id);
  if (existing) return existing;

  const attempt = (async () => {
    useConnectionStore.getState().setState(profile.id, "connecting");
    const probe = driver.checkAvailable?.bind(driver) ?? (async () => true);

    let ok = await probe(profile).catch(() => false);
    if (!ok) {
      await sleep(RETRY_DELAY_MS);
      ok = await probe(profile).catch(() => false);
    }

    useConnectionStore.getState().setState(profile.id, ok ? "connected" : "disconnected");
    return ok;
  })();

  inFlight.set(profile.id, attempt);
  void attempt.finally(() => inFlight.delete(profile.id));

  return attempt;
}

/** Lets a real print attempt's own success/failure update the status immediately — the strongest
 * possible signal, since it's not a probe but the actual outcome of sending a receipt. Called
 * from usePrintReceipt.ts and the printer wizard's test print. */
export function reportPrintResult(profileId: string, ok: boolean): void {
  useConnectionStore.getState().setState(profileId, ok ? "connected" : "disconnected");
}
