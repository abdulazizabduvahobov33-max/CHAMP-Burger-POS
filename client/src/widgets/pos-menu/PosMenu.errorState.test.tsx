// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCartStore } from "@/shared/stores/cartStore";

const refetchMock = vi.fn();

vi.mock("@/entities/product/api", () => ({
  useProducts: () => ({ data: undefined, isLoading: false, isError: true, refetch: refetchMock }),
}));

vi.mock("@/entities/category/api", () => ({
  useCategories: () => ({ data: [] }),
}));

import { PosMenu } from "./PosMenu";

// A failed menu fetch previously rendered the exact same "Меню пока пусто" empty state as a
// genuinely empty catalog (see the error/timeout/resilience audit) — a cashier had no way to
// tell "there really are no products" apart from "the request failed." This locks in the fix:
// a load failure must show an honest, retryable error, never the empty-catalog message.
describe("PosMenu — a failed fetch never reads as an empty catalog", () => {
  beforeEach(() => {
    refetchMock.mockReset();
    useCartStore.setState({ lines: [], tableId: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("shows a retryable error, not the empty-menu message, when the product fetch fails", async () => {
    const user = userEvent.setup();
    render(<PosMenu />);

    expect(screen.getByRole("alert")).toHaveTextContent("Не удалось загрузить меню");
    expect(screen.queryByText("Меню пока пусто")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Повторить" }));
    expect(refetchMock).toHaveBeenCalledTimes(1);
  });
});
