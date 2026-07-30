import { Download, RefreshCw, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { applyPwaUpdate } from "@/shared/lib/pwa";
import { usePwaStore } from "@/shared/stores/pwaStore";

/** App-wide install prompt + update-available toast. Mounted once at the root
 * (see `App.tsx`) so both work the same regardless of which page is active. */
export function PwaNotifications() {
  const { t } = useTranslation();
  const installPromptEvent = usePwaStore((s) => s.installPromptEvent);
  const isInstalled = usePwaStore((s) => s.isInstalled);
  const needRefresh = usePwaStore((s) => s.needRefresh);
  const setInstallPromptEvent = usePwaStore((s) => s.setInstallPromptEvent);
  const setNeedRefresh = usePwaStore((s) => s.setNeedRefresh);

  async function handleInstall() {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    await installPromptEvent.userChoice;
    setInstallPromptEvent(null);
  }

  const showInstall = installPromptEvent !== null && !isInstalled;

  if (!showInstall && !needRefresh) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex flex-col items-center gap-2 p-3 sm:items-end sm:p-4 [padding-top:max(0.75rem,env(safe-area-inset-top))]">
      {needRefresh && (
        <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-ink-line bg-ink-card p-3 shadow-card">
          <RefreshCw className="h-4 w-4 shrink-0 text-champ" />
          <p className="flex-1 text-sm text-white/80">{t("pwa.updateAvailable")}</p>
          <button
            type="button"
            onClick={applyPwaUpdate}
            className="shrink-0 rounded-lg bg-champ px-3 py-1.5 text-xs font-bold text-onaccent transition hover:bg-champ-hover"
          >
            {t("pwa.updateNow")}
          </button>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            aria-label={t("common.close")}
            className="shrink-0 rounded-lg p-1 text-white/40 transition hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {showInstall && (
        <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-ink-line bg-ink-card p-3 shadow-card">
          <Download className="h-4 w-4 shrink-0 text-champ" />
          <p className="flex-1 text-sm text-white/80">{t("pwa.installPrompt")}</p>
          <button
            type="button"
            onClick={handleInstall}
            className="shrink-0 rounded-lg bg-champ px-3 py-1.5 text-xs font-bold text-onaccent transition hover:bg-champ-hover"
          >
            {t("pwa.install")}
          </button>
          <button
            type="button"
            onClick={() => setInstallPromptEvent(null)}
            aria-label={t("common.close")}
            className="shrink-0 rounded-lg p-1 text-white/40 transition hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
