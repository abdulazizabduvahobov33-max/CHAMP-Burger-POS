import { useEffect } from "react";

import { useAuthStore } from "@/shared/stores/authStore";
import { armAutoplayUnlock } from "./sound";
import { useNotificationStream } from "./useNotificationStream";

/**
 * Renderless — mounted once in App.tsx alongside the other app-wide providers. Runs for BOTH
 * roles (a SELLER needs the stream too, for order.accepted/order.rejected toasts), unlike the
 * bell/popup/panel UI in widgets/notifications/AdminNotificationCenter.tsx, which is SUPER_ADMIN
 * only — this is why the two are separate components instead of one.
 */
export function NotificationStreamProvider() {
  useNotificationStream();

  const status = useAuthStore((s) => s.status);
  useEffect(() => {
    if (status === "authenticated") armAutoplayUnlock();
  }, [status]);

  return null;
}
