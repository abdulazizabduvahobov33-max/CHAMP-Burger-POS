import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { FullScreenSpinner } from "@/shared/ui/FullScreenSpinner";
import { useAuthStore, type Role } from "@/shared/stores/authStore";

export function roleHome(role: Role): string {
  if (role === "SUPER_ADMIN") return "/admin";
  if (role === "OWNER") return "/owner";
  return "/pos";
}

export function ProtectedRoute({
  roles,
  children,
  loginPath = "/login",
}: {
  roles: Role[];
  children: ReactNode;
  /** Where an unauthenticated visitor is sent — the owner panel uses its own "/owner/login"
   * instead of the normal cashier/waiter login page, so someone landing on an owner-only URL
   * (bookmarked, guessed, ...) without a session sees the locked owner gate, not the regular
   * login form. See routes.tsx's "/owner" route. */
  loginPath?: string;
}) {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (status === "idle" || status === "loading") {
    return <FullScreenSpinner />;
  }

  if (status !== "authenticated" || !user) {
    return <Navigate to={loginPath} replace state={{ from: location }} />;
  }

  if (!roles.includes(user.role)) {
    return <Navigate to={roleHome(user.role)} replace />;
  }

  return <>{children}</>;
}
