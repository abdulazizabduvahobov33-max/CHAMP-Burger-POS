import { registerSW } from "virtual:pwa-register";

import { usePwaStore, type BeforeInstallPromptEvent } from "@/shared/stores/pwaStore";

let applyUpdate: ((reloadPage?: boolean) => Promise<void>) | undefined;
let initialized = false;

/** Registers the service worker and wires up install/update events into `usePwaStore`.
 * Call once at app startup (see `main.tsx`) — safe to call more than once, only the first run does anything. */
export function initPwa() {
  if (initialized) return;
  initialized = true;

  applyUpdate = registerSW({
    immediate: true,
    onNeedRefresh() {
      usePwaStore.getState().setNeedRefresh(true);
    },
    onOfflineReady() {
      usePwaStore.getState().setOfflineReady(true);
    },
  });

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    usePwaStore.getState().setInstallPromptEvent(e as BeforeInstallPromptEvent);
  });

  window.addEventListener("appinstalled", () => {
    usePwaStore.getState().setInstalled(true);
    usePwaStore.getState().setInstallPromptEvent(null);
  });

  if (window.matchMedia("(display-mode: standalone)").matches) {
    usePwaStore.getState().setInstalled(true);
  }
}

/** Activates the waiting service worker and reloads the page onto the new version. */
export function applyPwaUpdate() {
  void applyUpdate?.(true);
}
