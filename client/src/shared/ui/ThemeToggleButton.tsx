import { Moon, Sun } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useThemeStore } from "@/shared/stores/themeStore";

/** Self-contained, like ChangePasswordButton/LogoutButton — drop next to them in any header. */
export function ThemeToggleButton() {
  const { t } = useTranslation();
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? t("common.lightTheme") : t("common.darkTheme")}
      title={isDark ? t("common.lightTheme") : t("common.darkTheme")}
      className="rounded-xl border border-ink-line p-2 text-white/50 transition hover:border-champ/50 hover:text-white"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}
