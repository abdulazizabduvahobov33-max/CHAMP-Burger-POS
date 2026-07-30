import { ru, uz } from "date-fns/locale";

import i18n from "@/shared/i18n";

/** date-fns locale for `format(...)` calls — follows the active UI language instead of being
 * hardcoded to Russian everywhere a date/time is displayed. */
export function dateFnsLocale() {
  return i18n.language === "uz" ? uz : ru;
}
