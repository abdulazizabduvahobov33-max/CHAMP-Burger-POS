import { useEffect, type ReactNode } from "react";

import { refreshAccessToken } from "@/shared/lib/api";
import { useAuthStore } from "@/shared/stores/authStore";

// Render's free tier lets an idle backend spin down; empirically observed cold start is on the
// order of ~60s (see docs/DEPLOYMENT notes on the Oregon backend). This is spent ONLY on the one
// silent refresh every app load makes before rendering anything — not applied to
// DEFAULT_TIMEOUT_MS globally, which would make every ordinary request wait needlessly long for
// its own timeout to fire on a genuinely stuck connection once the backend is actually warm.
const BOOTSTRAP_REFRESH_TIMEOUT_MS = 70_000;

/**
 * Runs once on app load: tries to silently restore a session from the
 * httpOnly refresh cookie before any route renders. Goes through the same
 * single-flight `refreshAccessToken` the response interceptor uses, so a
 * duplicate effect run (React 18 StrictMode in dev) can't race two refresh
 * calls against the same single-use refresh token. FullScreenSpinner (shown
 * for the whole "loading" status below, via ProtectedRoute/RoleHome) already
 * surfaces a "server starting" hint on its own after a few seconds, so a
 * cold start here reads as an explained wait, not a hang.
 */
export function AuthBootstrap({ children }: { children: ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const setStatus = useAuthStore((s) => s.setStatus);

  useEffect(() => {
    if (status !== "idle") return;
    setStatus("loading");
    void refreshAccessToken(BOOTSTRAP_REFRESH_TIMEOUT_MS);
  }, [status, setStatus]);

  return <>{children}</>;
}
