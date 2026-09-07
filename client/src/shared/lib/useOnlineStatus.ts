import { useEffect, useState } from "react";

/**
 * `navigator.onLine` only reflects whether the OS thinks it has a network interface up — a
 * device connected to a WiFi with no real internet (or one where only this app's backend is
 * unreachable) still reports `true`. Treat this as a secondary hint only ("the browser itself
 * says there's definitely no connection"), never as the sole signal that a request will
 * succeed — every real request still surfaces its own actual outcome (see shared/lib/errors.ts).
 */
export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine));

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}
