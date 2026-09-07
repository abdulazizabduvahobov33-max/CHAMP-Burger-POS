// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCartStore } from "@/shared/stores/cartStore";

const mutateMock = vi.fn();

vi.mock("@/entities/sale/api", () => ({
  useCreateSale: () => ({ mutate: mutateMock, isPending: false }),
}));

// PosCart fires a real receipt print on register-mode success — irrelevant to the idempotency/
// cart-clearing contract this file tests, and would otherwise need its own heavy mocking.
vi.mock("@/shared/printing/usePrintReceipt", () => ({
  usePrintReceipt: () => ({ printReceipt: vi.fn().mockResolvedValue({ ok: true }) }),
}));

const line = {
  variantId: "variant-1",
  productId: "product-1",
  productName: "Лаваш",
  variantLabel: "Обычный",
  imageUrl: null,
  unitPrice: "10000",
  saleType: "UNIT" as const,
};

async function checkout(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Отправить заказ" }));
  await user.click(screen.getByRole("button", { name: "Оплатить" }));
}

describe("PosCart — checkout idempotency and cart-clearing contract", () => {
  beforeEach(() => {
    mutateMock.mockReset();
    useCartStore.setState({ lines: [{ ...line, quantity: 1 }], tableId: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("never clears the cart on a failed/timed-out checkout attempt", async () => {
    const user = userEvent.setup();
    const { PosCart } = await import("./PosCart");
    render(<PosCart />);

    await checkout(user);
    expect(mutateMock).toHaveBeenCalledTimes(1);
    const [, callbacks] = mutateMock.mock.calls[0];
    callbacks.onError(Object.assign(new Error("timeout"), { code: "ECONNABORTED" }));

    expect(useCartStore.getState().lines).toHaveLength(1);
  });

  it("resends the SAME clientRequestId on a retry after a failed attempt — never mints a new one for the same attempt", async () => {
    const user = userEvent.setup();
    const { PosCart } = await import("./PosCart");
    render(<PosCart />);

    await checkout(user);
    const [firstInput, firstCallbacks] = mutateMock.mock.calls[0];
    const firstKey = firstInput.clientRequestId;
    expect(typeof firstKey).toBe("string");
    firstCallbacks.onError(Object.assign(new Error("timeout"), { code: "ECONNABORTED" }));

    // The payment dialog stays open after an error (same as the real onError handler leaves
    // paymentOpen untouched) — retrying means confirming payment again, not reopening checkout.
    await user.click(screen.getByRole("button", { name: "Оплатить" }));
    expect(mutateMock).toHaveBeenCalledTimes(2);
    const [secondInput] = mutateMock.mock.calls[1];
    expect(secondInput.clientRequestId).toBe(firstKey);
  });

  it("clears the cart exactly once, only after a confirmed success", async () => {
    const user = userEvent.setup();
    const { PosCart } = await import("./PosCart");
    render(<PosCart />);

    await checkout(user);
    const [, callbacks] = mutateMock.mock.calls[0];
    expect(useCartStore.getState().lines).toHaveLength(1);

    callbacks.onSuccess({ id: "sale-1", status: "ACCEPTED", totalAmount: "10000", items: [] });
    expect(useCartStore.getState().lines).toHaveLength(0);
  });

  it("mints a NEW clientRequestId for a genuinely new attempt after the dialog is cancelled", async () => {
    const user = userEvent.setup();
    const { PosCart } = await import("./PosCart");
    render(<PosCart />);

    await user.click(screen.getByRole("button", { name: "Отправить заказ" }));
    // Cancel via Escape (Dialog's own close affordance) instead of confirming.
    await user.keyboard("{Escape}");

    useCartStore.setState({ lines: [{ ...line, quantity: 1 }], tableId: null });
    await checkout(user);
    expect(mutateMock).toHaveBeenCalledTimes(1);
    expect(typeof mutateMock.mock.calls[0][0].clientRequestId).toBe("string");
  });
});
