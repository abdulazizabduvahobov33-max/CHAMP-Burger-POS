import { AppRoutes } from "@/app/routes";
import { AuthBootstrap } from "@/features/auth/AuthBootstrap";
import { NotificationStreamProvider } from "@/shared/notifications/NotificationStreamProvider";
import { ReceiptPreviewDialog } from "@/shared/printing/ReceiptPreviewDialog";
import { PwaNotifications } from "@/shared/ui/PwaNotifications";
import { ToastContainer } from "@/shared/ui/ToastContainer";
import { AdminNotificationCenter } from "@/widgets/notifications/AdminNotificationCenter";

export default function App() {
  return (
    <AuthBootstrap>
      <AppRoutes />
      <PwaNotifications />
      <ToastContainer />
      <ReceiptPreviewDialog />
      <NotificationStreamProvider />
      <AdminNotificationCenter />
    </AuthBootstrap>
  );
}
