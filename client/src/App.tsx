import { AppRoutes } from "@/app/routes";
import { AuthBootstrap } from "@/features/auth/AuthBootstrap";
import { ReceiptPreviewDialog } from "@/shared/printing/ReceiptPreviewDialog";
import { PwaNotifications } from "@/shared/ui/PwaNotifications";
import { ToastContainer } from "@/shared/ui/ToastContainer";

export default function App() {
  return (
    <AuthBootstrap>
      <AppRoutes />
      <PwaNotifications />
      <ToastContainer />
      <ReceiptPreviewDialog />
    </AuthBootstrap>
  );
}
