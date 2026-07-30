import { useEffect, type ReactNode } from "react";

import { useThemeStore } from "@/shared/stores/themeStore";

/**
 * Keeps `<html data-theme>` (and the native `color-scheme`, via CSS — see styles/index.css)
 * in sync with the theme store. The actual palette swap happens entirely in CSS custom
 * properties (tailwind.config.ts colors all resolve through `var(--color-*)`), so no
 * component needs to know which theme is active — this provider's only job is the one DOM
 * side effect that makes the CSS variables switch.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return <>{children}</>;
}
