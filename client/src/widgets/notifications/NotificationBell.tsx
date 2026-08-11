import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";

import { usePendingSales } from "@/entities/sale/api";
import { useNotificationStore } from "@/shared/notifications/notificationStore";

/**
 * Fixed, floating — mounted once at the app root (see App.tsx / AdminNotificationCenter.tsx),
 * not inside any one page's header, specifically so a cashier sees the pending-orders count no
 * matter which admin page they're on (products, settings, history, ...), not just the register.
 *
 * Bottom-right, not top-right: every admin page already puts its own controls (logout, overflow
 * menu, user name) in the header's top-right corner — anchoring here instead avoids covering
 * them on every single page. The offset is tall enough to clear PosCart's mobile summary bar
 * (the one page-level bottom-fixed element a SUPER_ADMIN can see, on AdminPosPage's small-screen
 * layout) rather than sitting flush at the very bottom edge.
 */
export function NotificationBell() {
  const { t } = useTranslation();
  const { data: pending } = usePendingSales();
  const setPendingPanelOpen = useNotificationStore((s) => s.setPendingPanelOpen);
  const count = pending?.length ?? 0;

  return (
    <button
      type="button"
      onClick={() => setPendingPanelOpen(true)}
      aria-label={t("pos.pending.title")}
      className="fixed z-[55] flex h-11 w-11 items-center justify-center rounded-full border border-ink-line bg-ink-card text-white/70 shadow-card transition hover:border-champ/50 hover:text-white [bottom:max(6rem,calc(env(safe-area-inset-bottom)+5rem))] [right:max(1rem,env(safe-area-inset-right))]"
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-onaccent">
          {count}
        </span>
      )}
    </button>
  );
}
