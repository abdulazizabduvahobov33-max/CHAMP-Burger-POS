import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

// A bare spinner with no explanation, held up long enough, reads as a broken/hung page — this is
// exactly the "вечный spinner" state a Render free-tier cold start (or any slow/stalled request)
// must not produce. After this delay, an honest "server is starting" hint appears alongside the
// spinner instead of leaving it unexplained. Deliberately NOT tied to any real timeout/retry
// logic itself — this is presentation only; see shared/lib/api.ts / AuthBootstrap.tsx for the
// actual request timeout/retry behavior this is describing to the user.
const SLOW_HINT_DELAY_MS = 4000;

export function FullScreenSpinner() {
  const { t } = useTranslation();
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowHint(true), SLOW_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-champ border-t-transparent" />
      {showHint && <p className="animate-fade-in text-sm text-white/40">{t("common.serverStarting")}</p>}
    </div>
  );
}
