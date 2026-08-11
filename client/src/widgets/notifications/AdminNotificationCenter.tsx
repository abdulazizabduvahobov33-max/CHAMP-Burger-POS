import { useNotificationStore } from "@/shared/notifications/notificationStore";
import { useAuthStore } from "@/shared/stores/authStore";
import { PendingOrdersPanel } from "@/widgets/pending-orders/PendingOrdersPanel";
import { NotificationBell } from "./NotificationBell";
import { OrderNotificationStack } from "./OrderNotificationStack";

/**
 * Mounted once in App.tsx, renders nothing for a SELLER — the bell, the persistent "new order"
 * popups, and the pending-orders panel are all cashier/admin concepts. The panel used to be
 * mounted only inside AdminPosPage; it lives here now (driven by notificationStore's
 * pendingPanelOpen) so the bell can open it from *any* admin page, not just the register.
 */
export function AdminNotificationCenter() {
  const role = useAuthStore((s) => s.user?.role);
  const pendingPanelOpen = useNotificationStore((s) => s.pendingPanelOpen);
  const setPendingPanelOpen = useNotificationStore((s) => s.setPendingPanelOpen);

  if (role !== "SUPER_ADMIN") return null;

  return (
    <>
      <NotificationBell />
      <OrderNotificationStack />
      <PendingOrdersPanel open={pendingPanelOpen} onClose={() => setPendingPanelOpen(false)} />
    </>
  );
}
