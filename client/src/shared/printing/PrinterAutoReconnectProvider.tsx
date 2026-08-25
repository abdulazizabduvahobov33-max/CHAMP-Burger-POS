import { useEffect } from "react";

import { ensureConnected } from "./printerConnectionManager";
import { getActiveReceiptTarget } from "./printerRegistry";

/**
 * Wires the paired register printer's reconnect attempts to real, infrequent triggers only —
 * never a timer. Exported as a plain function (not the effect body itself) so it's unit-testable
 * without rendering React: dispatch a "visibilitychange"/"online" event at it in a test and
 * assert `attempt` fired, no component tree required.
 *
 * Covers, without any polling loop:
 *   - "next time the site opens" / "after a page refresh" — the initial `attempt()` call below.
 *   - tablet/PC waking from sleep, app regaining focus — `visibilitychange` → "visible".
 *   - network coming back after a drop — `online`.
 *   - USB unplugged-then-replugged while the tab stayed open the whole time — not caught here
 *     (neither event fires for that), but covered by usePrintReceipt.ts's own pre-flight check
 *     right before the next real print, per the same requirement.
 */
export function setupAutoReconnectListeners(attempt: () => void = defaultAttempt): () => void {
  attempt();

  function onVisibilityChange() {
    if (document.visibilityState === "visible") attempt();
  }

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("online", attempt);

  return () => {
    document.removeEventListener("visibilitychange", onVisibilityChange);
    window.removeEventListener("online", attempt);
  };
}

function defaultAttempt(): void {
  const { driver, profile } = getActiveReceiptTarget();
  if (profile.transport === "preview") return;
  void ensureConnected(driver, profile);
}

/** Mounted once at the app root (see App.tsx) — a sibling of NotificationStreamProvider, same
 * "one global side-effect component, not per-page" shape. Renders nothing. */
export function PrinterAutoReconnectProvider() {
  useEffect(() => setupAutoReconnectListeners(), []);
  return null;
}
