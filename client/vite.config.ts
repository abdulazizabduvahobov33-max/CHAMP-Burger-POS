import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: null,
      includeAssets: ["icons/favicon-32.png", "icons/apple-touch-icon.png"],
      manifest: {
        id: "/",
        name: "Sharof KFS — POS + Inventory",
        short_name: "Sharof KFS",
        description: "POS и учёт склада для Sharof KFS",
        start_url: "/",
        scope: "/",
        display: "standalone",
        display_override: ["standalone", "minimal-ui"],
        background_color: "#0E0E10",
        theme_color: "#0E0E10",
        orientation: "any",
        lang: "ru",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Only the static app shell (JS/CSS/HTML/icons/fonts) is cached for offline use —
        // /api and /uploads are deliberately left out of runtime caching so the POS/inventory
        // UI never serves stale prices, stock levels, or sales data while offline.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Without this, every route (including /login, which React.lazy() already keeps out of
        // the other page bundles — see app/routes.tsx) still pulls in one shared "everything
        // else" chunk containing react/react-dom/router/react-query/zustand/axios/i18next, since
        // Rollup's default single-vendor-chunk behavior doesn't split further on its own. Splitting
        // these into their own chunks means: (1) that shared code is cache-stable across deploys
        // (it only changes when a dependency version bumps, not on every app-code change, so
        // returning users re-download less), and (2) the framework/runtime chunk and the
        // data/state-layer chunk can load in parallel instead of as one monolithic blob. Pure
        // build output shape — no runtime/behavior change.
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-data": ["@tanstack/react-query", "zustand", "axios"],
          "vendor-i18n": ["i18next", "react-i18next", "i18next-browser-languagedetector"],
        },
      },
    },
  },
  server: {
    port: 5173,
    // Proxy /api to the backend during development so the client can call
    // relative URLs and avoid CORS friction.
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
