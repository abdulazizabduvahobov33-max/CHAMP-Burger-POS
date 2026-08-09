import { AxiosError } from "axios";

import i18n from "@/shared/i18n";
import { translateServerMessage } from "./serverErrorTranslations";

// Not a hook — called from plain mutation callbacks, not just component render bodies — so
// this reads the shared i18n instance directly rather than via useTranslation(). It still
// reflects whichever language is currently active; it just isn't reactive on its own (fine
// here, since callers use it once per error event, not in JSX that needs to re-render on a
// language switch).
export function getErrorMessage(error: unknown, fallback = i18n.t("common.genericError")): string {
  if (error instanceof AxiosError) {
    const message = (error.response?.data as { error?: { message?: string } } | undefined)?.error?.message;
    // The API has no i18n of its own — it always answers in Russian (see
    // shared/lib/serverErrorTranslations.ts for why translating by exact text, not touching the
    // server, is the safe fix here).
    if (typeof message === "string") return translateServerMessage(message, i18n.language);

    // No structured `{ error: { message } }` body — the request reached *something*, just not
    // the API responding as expected (wrong URL, a proxy/host returning HTML or an empty body,
    // an unhandled 500, ...). Log the full shape so it's diagnosable from the browser console
    // without needing server-side log access, and surface the status code in the visible
    // message too instead of a completely generic string that gives no lead at all.
    if (error.response) {
      // eslint-disable-next-line no-console
      console.error("[KRUNCH] API error without a structured message:", {
        url: (error.config?.baseURL ?? "") + (error.config?.url ?? ""),
        method: error.config?.method,
        status: error.response.status,
        data: error.response.data,
      });
      return `${fallback} (${error.response.status})`;
    }

    if (error.code === "ERR_NETWORK") return i18n.t("common.networkError");
  }
  return fallback;
}
