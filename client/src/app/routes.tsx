import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "@/features/auth/LoginPage";
import { OwnerLoginPage } from "@/features/auth/OwnerLoginPage";
import { ProtectedRoute, roleHome } from "@/features/auth/ProtectedRoute";
import { FullScreenSpinner } from "@/shared/ui/FullScreenSpinner";
import { PageTransition } from "@/shared/ui/PageTransition";
import { useAuthStore } from "@/shared/stores/authStore";

// Route-level code splitting — each admin/POS page ships as its own chunk instead of one
// monolithic bundle, since a given session only ever needs the pages for its one role.
const AdminDashboardPage = lazy(() => import("@/pages/AdminDashboardPage"));
const AdminPosPage = lazy(() => import("@/pages/AdminPosPage"));
const AiAssistantPage = lazy(() => import("@/pages/AiAssistantPage"));
const ProductsPage = lazy(() => import("@/pages/ProductsPage"));
const ProfitPage = lazy(() => import("@/pages/ProfitPage"));
const PurchasesPage = lazy(() => import("@/pages/PurchasesPage"));
const ReportsPage = lazy(() => import("@/pages/ReportsPage"));
const SellerHistoryPage = lazy(() => import("@/pages/SellerHistoryPage"));
const SellerPosPage = lazy(() => import("@/pages/SellerPosPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const StockIntakePage = lazy(() => import("@/pages/StockIntakePage"));
const TablesPage = lazy(() => import("@/pages/TablesPage"));
const OwnerDashboardPage = lazy(() => import("@/pages/OwnerDashboardPage"));
const UsersPage = lazy(() => import("@/pages/UsersPage"));
const WarehousePage = lazy(() => import("@/pages/WarehousePage"));

function RoleHome() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  if (status === "idle" || status === "loading") {
    return <FullScreenSpinner />;
  }

  return <Navigate to={user ? roleHome(user.role) : "/login"} replace />;
}

export function AppRoutes() {
  return (
    <PageTransition>
      <Suspense fallback={<FullScreenSpinner />}>
      <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Deliberately not linked from anywhere in the normal admin/waiter UI — see
          OwnerLoginPage.tsx and ProtectedRoute's loginPath prop for why this is a fully separate
          gate, not just a role check layered on the regular /login. */}
      <Route path="/owner/login" element={<OwnerLoginPage />} />

      <Route
        path="/owner"
        element={
          <ProtectedRoute roles={["OWNER"]} loginPath="/owner/login">
            <OwnerDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <AdminDashboardPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/pos"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <AdminPosPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/warehouse"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <WarehousePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/intake"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <StockIntakePage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/products"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <ProductsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/reports"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <ReportsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/purchases"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <PurchasesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/profit"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <ProfitPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/users"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <UsersPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/tables"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <TablesPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <SettingsPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/ai"
        element={
          <ProtectedRoute roles={["SUPER_ADMIN"]}>
            <AiAssistantPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pos"
        element={
          <ProtectedRoute roles={["SELLER"]}>
            <SellerPosPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/pos/history"
        element={
          <ProtectedRoute roles={["SELLER"]}>
            <SellerHistoryPage />
          </ProtectedRoute>
        }
      />

      <Route path="/" element={<RoleHome />} />
      <Route path="*" element={<RoleHome />} />
      </Routes>
      </Suspense>
    </PageTransition>
  );
}
