import { WifiOff } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useOnlineStatus } from "@/shared/lib/useOnlineStatus";

/** Mounted once at the app root — a small, honest, non-blocking hint that the browser itself
 * reports no network connection. Never the only signal a specific action failed (see
 * shared/lib/errors.ts) — this only covers the "definitely offline" case navigator.onLine can
 * actually detect; it disappears the instant the browser reports a connection again. */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const { t } = useTranslation();

  if (online) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] flex animate-fade-in items-center justify-center gap-2 bg-danger px-4 py-2 text-center text-sm font-medium text-white [padding-top:max(0.5rem,env(safe-area-inset-top))]"
    >
      <WifiOff className="h-4 w-4 shrink-0" />
      {t("common.offline")}
    </div>
  );
}
