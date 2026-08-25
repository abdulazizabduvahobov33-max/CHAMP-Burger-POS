// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";

import { setupAutoReconnectListeners } from "./PrinterAutoReconnectProvider";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
}

describe("setupAutoReconnectListeners", () => {
  afterEach(() => {
    setVisibility("visible");
  });

  it("attempts a reconnect immediately on setup — covers 'next time the site opens' / 'after a refresh'", () => {
    const attempt = vi.fn();
    const cleanup = setupAutoReconnectListeners(attempt);

    expect(attempt).toHaveBeenCalledTimes(1);

    cleanup();
  });

  it("attempts a reconnect when the tab/app becomes visible again (tablet waking from sleep)", () => {
    const attempt = vi.fn();
    const cleanup = setupAutoReconnectListeners(attempt);

    setVisibility("visible");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(attempt).toHaveBeenCalledTimes(2); // initial call + the visibility one

    cleanup();
  });

  it("does NOT attempt a reconnect when the tab becomes hidden", () => {
    const attempt = vi.fn();
    const cleanup = setupAutoReconnectListeners(attempt);

    setVisibility("hidden");
    document.dispatchEvent(new Event("visibilitychange"));

    expect(attempt).toHaveBeenCalledTimes(1); // only the initial call

    cleanup();
  });

  it("attempts a reconnect when the browser comes back online", () => {
    const attempt = vi.fn();
    const cleanup = setupAutoReconnectListeners(attempt);

    window.dispatchEvent(new Event("online"));

    expect(attempt).toHaveBeenCalledTimes(2);

    cleanup();
  });

  it("stops reacting to either event once cleaned up — no leaked listeners across reconnects", () => {
    const attempt = vi.fn();
    const cleanup = setupAutoReconnectListeners(attempt);
    cleanup();

    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("online"));

    expect(attempt).toHaveBeenCalledTimes(1); // only the initial call from setup, nothing after
  });
});
