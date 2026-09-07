import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";

import { shouldRetryRead } from "@/shared/lib/queryRetry";
import { ThemeProvider } from "@/shared/providers/ThemeProvider";

/**
 * Global providers. React Query manages all server state; auth state lives
 * in a Zustand store (see shared/stores/authStore.ts) and needs no provider.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryRead,
      // Capped exponential backoff (1s, 2s, then the cap) — same shape as the SSE reconnect
      // logic (shared/notifications/useNotificationStream.ts), just a much lower ceiling since a
      // read that's still failing after a couple of quick retries should surface its own visible
      // "Повторить" action instead of silently retrying for a long time in the background.
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>{children}</BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
