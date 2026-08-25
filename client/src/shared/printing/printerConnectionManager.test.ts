import { describe, expect, it, vi } from "vitest";

import type { PrinterProfile, ReceiptPrinterDriver } from "./model";
import { ensureConnected } from "./printerConnectionManager";

function makeProfile(id: string): PrinterProfile {
  return { id, name: "Test printer", role: "register", transport: "webusb", paperWidthMm: 58, usb: { vendorId: 1, productId: 2 } };
}

function makeDriver(checkAvailable: ReceiptPrinterDriver["checkAvailable"]): ReceiptPrinterDriver {
  return {
    transport: "webusb",
    label: "Test",
    isSupported: () => true,
    pair: async () => ({ ok: false, error: "not used in these tests" }),
    print: async () => ({ ok: true }),
    checkAvailable,
  };
}

describe("ensureConnected", () => {
  it("shares one in-flight attempt across two concurrent calls for the same profile", async () => {
    // Never resolves until the test explicitly does — proves a second caller arriving while the
    // first is still pending gets the SAME promise instead of starting its own probe (checked
    // below via the call count), which is what actually prevents two overlapping
    // WebBluetooth gatt.connect() attempts on the same physical device.
    let resolveProbe!: (ok: boolean) => void;
    const probe = new Promise<boolean>((resolve) => (resolveProbe = resolve));
    const checkAvailable = vi.fn().mockReturnValue(probe);
    const driver = makeDriver(checkAvailable);
    const profile = makeProfile("concurrent");

    const first = ensureConnected(driver, profile);
    const second = ensureConnected(driver, profile);

    resolveProbe(true);
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toBe(true);
    expect(secondResult).toBe(true);
    expect(checkAvailable).toHaveBeenCalledTimes(1);
  });

  it("retries exactly once after a transient failure, then succeeds", async () => {
    const checkAvailable = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const driver = makeDriver(checkAvailable);
    const profile = makeProfile("transient");

    const ok = await ensureConnected(driver, profile);

    expect(ok).toBe(true);
    expect(checkAvailable).toHaveBeenCalledTimes(2);
  });

  it("gives up after one retry on a permanent failure and never probes again on its own", async () => {
    const checkAvailable = vi.fn().mockResolvedValue(false);
    const driver = makeDriver(checkAvailable);
    const profile = makeProfile("permanent");

    const ok = await ensureConnected(driver, profile);

    expect(ok).toBe(false);
    expect(checkAvailable).toHaveBeenCalledTimes(2);

    // Nothing here schedules a third attempt on its own — waiting well past another retry
    // window with no further call to ensureConnected() must leave the count unchanged. This is
    // the actual proof there's no reconnect loop: a permanently unreachable printer settles at
    // "disconnected" and stays quiet until a real external trigger calls ensureConnected() again.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    expect(checkAvailable).toHaveBeenCalledTimes(2);
  }, 10_000);

  it("treats a driver with no checkAvailable() (e.g. the preview driver) as always available", async () => {
    const driver = makeDriver(undefined);
    const profile = makeProfile("no-probe");

    const ok = await ensureConnected(driver, profile);

    expect(ok).toBe(true);
  });
});
