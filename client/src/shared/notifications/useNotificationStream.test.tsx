// @vitest-environment jsdom
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthStore } from "@/shared/stores/authStore";
import { useNotificationStream } from "./useNotificationStream";

class MockEventSource {
  static instances: MockEventSource[] = [];
  closed = false;
  onerror: (() => void) | null = null;
  private listeners: Record<string, ((e: MessageEvent) => void)[]> = {};

  constructor(public url: string) {
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, cb: (e: MessageEvent) => void) {
    (this.listeners[type] ??= []).push(cb);
  }

  close() {
    this.closed = true;
  }

  triggerError() {
    this.onerror?.();
  }
}

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useNotificationStream — SSE connection lifecycle", () => {
  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
    vi.useFakeTimers();
    useAuthStore.setState({
      status: "authenticated",
      user: { id: "u1", name: "Test", login: "test", role: "SELLER", locationId: "loc-1" },
      accessToken: "fake-token",
    });
  });

  afterEach(() => {
    // Unmount whatever the previous test rendered BEFORE restoring real timers — otherwise its
    // effect/cleanup (which clears a pending backoff timeout) runs against fake timers that no
    // longer exist, and the still-mounted hook keeps reconnecting into the NEXT test's (reset)
    // MockEventSource.instances array.
    cleanup();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    useAuthStore.setState({ status: "unauthenticated", user: null, accessToken: null });
  });

  it("opens exactly one connection while authenticated", () => {
    renderHook(() => useNotificationStream(), { wrapper });
    expect(MockEventSource.instances).toHaveLength(1);
  });

  it("does not open a connection when unauthenticated", () => {
    useAuthStore.setState({ status: "unauthenticated", user: null, accessToken: null });
    renderHook(() => useNotificationStream(), { wrapper });
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it("reconnects with bounded backoff after a drop — never more than one connection open at a time", () => {
    renderHook(() => useNotificationStream(), { wrapper });
    expect(MockEventSource.instances).toHaveLength(1);

    MockEventSource.instances[0].triggerError();
    expect(MockEventSource.instances[0].closed).toBe(true);
    // No new connection until the backoff timer actually fires — not an immediate storm.
    expect(MockEventSource.instances).toHaveLength(1);

    vi.advanceTimersByTime(2000); // INITIAL_RETRY_MS
    expect(MockEventSource.instances).toHaveLength(2);

    // Second failure backs off further (doubled), not an immediate third connection either.
    MockEventSource.instances[1].triggerError();
    vi.advanceTimersByTime(2000);
    expect(MockEventSource.instances).toHaveLength(2);
    vi.advanceTimersByTime(2000); // total 4000ms = the doubled delay
    expect(MockEventSource.instances).toHaveLength(3);
  });

  it("stops reconnecting and closes the connection on unmount", () => {
    const { unmount } = renderHook(() => useNotificationStream(), { wrapper });
    expect(MockEventSource.instances).toHaveLength(1);

    unmount();
    expect(MockEventSource.instances[0].closed).toBe(true);

    vi.advanceTimersByTime(60_000);
    expect(MockEventSource.instances).toHaveLength(1); // no reconnect after unmount
  });
});
