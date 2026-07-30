import { useEffect, type ReactNode } from "react";

import { refreshAccessToken } from "@/shared/lib/api";
import { useAuthStore } from "@/shared/stores/authStore";

/**
 * Runs once on app load: tries to silently restore a session from the
 * httpOnly refresh cookie before any route renders. Goes through the same
 * single-flight `refreshAccessToken` the response interceptor uses, so a
 * duplicate effect run (React 18 StrictMode in dev) can't race two refresh
 * calls against the same single-use refresh token.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const setStatus = useAuthStore((s) => s.setStatus);

  useEffect(() => {
    if (status !== "idle") return;
    setStatus("loading");
    void refreshAccessToken();
  }, [status, setStatus]);

  return <>{children}</>;
}
