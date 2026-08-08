import { create } from "zustand";

export type Theme = "dark" | "light";

// Brand-neutral on purpose (not tied to any one client's name) so a future rebrand — like this
// one, moving off the old "champ-theme" key — never needs to touch this again.
const STORAGE_KEY = "pos-theme";
const LEGACY_STORAGE_KEY = "champ-theme";

function getInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

type ThemeState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

/**
 * Same shape as authStore/cartStore — plain Zustand, no React Context needed since the store
 * is already globally accessible via the hook. `ThemeProvider` (shared/providers/ThemeProvider)
 * just keeps `<html data-theme>` in sync with this value; index.html has a tiny inline script
 * that sets the attribute once synchronously before React mounts, to avoid a flash of the
 * wrong theme on load.
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    set({ theme });
  },
  toggleTheme: () => {
    const next: Theme = get().theme === "dark" ? "light" : "dark";
    localStorage.setItem(STORAGE_KEY, next);
    set({ theme: next });
  },
}));
