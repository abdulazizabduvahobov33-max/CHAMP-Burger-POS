import type { Config } from "tailwindcss";

/**
 * KRUNCH design tokens.
 *   • ink        — near-black graphite background
 *   • champ      — signature KRUNCH red-orange "flame" accent (token name kept from a prior
 *                  rebrand — see src/styles/index.css for why renaming it wasn't worth the risk)
 *   • danger     — rose-red, deliberately pushed away from the champ hue so alerts never read
 *                  as "just another shade of the brand color"
 *
 * Every token below resolves through a CSS custom property (see src/styles/index.css) instead
 * of a fixed hex value, so the same `bg-ink-card`/`text-white`/`text-champ`/... classes already
 * used throughout the app automatically repaint for light/dark theme — no component needed to
 * change. `<alpha-value>` keeps opacity modifiers (`text-white/50`, `bg-champ/15`, ...) working
 * exactly as before, since Tailwind substitutes it into `rgb(var(--x) / <alpha-value>)`.
 *
 * `white` itself is overridden here (not just extended) because the app already uses Tailwind's
 * built-in `text-white`/`bg-white` as its primary "foreground on a dark surface" utility
 * everywhere — remapping that one keyword through a variable was the only way to theme the
 * whole app without touching every component's className string.
 */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "rgb(var(--color-bg) / <alpha-value>)",
          soft: "rgb(var(--color-bg-soft) / <alpha-value>)",
          card: "rgb(var(--color-bg-card) / <alpha-value>)",
          line: "rgb(var(--color-bg-line) / <alpha-value>)",
        },
        white: "rgb(var(--color-fg) / <alpha-value>)",
        // Fixed dark text for use ON TOP of a bright accent surface (bg-champ/success/danger
        // buttons and pills) — always dark regardless of theme, unlike `ink` above which is
        // the page/surface background and DOES flip with the theme.
        onaccent: "rgb(var(--color-onaccent) / <alpha-value>)",
        champ: {
          DEFAULT: "rgb(var(--color-champ) / <alpha-value>)",
          hover: "rgb(var(--color-champ-hover) / <alpha-value>)",
          dark: "rgb(var(--color-champ-dark) / <alpha-value>)",
        },
        danger: {
          DEFAULT: "rgb(var(--color-danger) / <alpha-value>)",
          soft: "rgb(var(--color-danger-soft) / <alpha-value>)",
        },
        success: "rgb(var(--color-success) / <alpha-value>)",
        warn: "rgb(var(--color-warn) / <alpha-value>)",
      },
      borderRadius: {
        pill: "9999px",
        card: "16px",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.08), 0 12px 28px -8px rgba(0,0,0,0.22)",
        // Elevated hover state for cards that use `shadow-card` at rest — deeper than the resting
        // shadow but still tuned to the same neutral tone, instead of mixing in Tailwind's
        // default `shadow-lg` (a visibly different, untinted shadow) on hover.
        "card-hover": "0 2px 4px rgba(0,0,0,0.1), 0 18px 38px -8px rgba(0,0,0,0.28)",
        glow: "0 8px 32px -6px rgba(255,90,54,0.35)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.96) translateY(8px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "backdrop-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.3s ease-out",
        "scale-in": "scale-in 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        "backdrop-in": "backdrop-in 0.2s ease-out",
      },
    },
  },
  plugins: [],
} satisfies Config;
