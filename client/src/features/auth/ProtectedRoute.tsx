import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { FullScreenSpinner } from "@/shared/ui/FullScreenSpinner";
import { useAuthStore, type Role } from "@/shared/stores/authStore";

export function roleHome(role: Role): string {
  return role === "SUPER_ADMIN" ? "/admin" : "/pos";
}

export function ProtectedRoute({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (status === "idle" || status === "loading") {
    return <FullScreenSpinner />;
  }

  if (status !== "authenticated" || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return <>{children}</>;
}
