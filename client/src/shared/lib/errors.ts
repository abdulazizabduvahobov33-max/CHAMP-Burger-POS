import { AxiosError } from "axios";

import i18n from "@/shared/i18n";

// Not a hook — called from plain mutation callbacks, not just component render bodies — so
// this reads the shared i18n instance directly rather than via useTranslation(). It still
// reflects whichever language is currently active; it just isn't reactive on its own (fine
// here, since callers use it once per error event, not in JSX that needs to re-render on a
// language switch).
export function getErrorMessage(error: unknown, fallback = i18n.t("common.genericError")): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    if (typeof message === "string") return message;
    if (error.code === "ERR_NETWORK") return i18n.t("common.networkError");
  }
  return fallback;
}
