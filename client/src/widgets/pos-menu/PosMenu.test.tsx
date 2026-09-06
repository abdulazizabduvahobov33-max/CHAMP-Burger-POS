// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCartStore } from "@/shared/stores/cartStore";

const singleVariantProduct = {
  id: "prod-single",
  name: "Лаваш",
  categoryId: "cat-1",
  categoryName: "Прочее",
  imageUrl: null,
  saleType: "UNIT" as const,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  variants: [{ id: "variant-single", label: "Обычный", price: "10000" }],
};

// Labels are deliberately real, descriptive words (not price-shaped strings) so assertions below
// never depend on locale-specific number formatting — production data sometimes uses the price
// itself as the label (see PosMenu's isLabelJustThePrice), but that's a display-collapsing detail
// unrelated to what this file is testing (add/open/close/cart correctness).
const multiVariantProduct = {
  id: "prod-multi",
  name: "Хот-дог",
  categoryId: "cat-1",
  categoryName: "Прочее",
  imageUrl: null,
  saleType: "UNIT" as const,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  variants: [
    { id: "variant-small", label: "Маленький", price: "15000" },
    { id: "variant-large", label: "Большой", price: "18000" },
  ],
};

const drinkProduct = {
  id: "prod-drink",
  name: "Cola",
  categoryId: "cat-2",
  categoryName: "Напитки",
  imageUrl: null,
  saleType: "UNIT" as const,
  isActive: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  variants: [{ id: "variant-drink", label: "Бутылка", price: "5000" }],
};

vi.mock("@/entities/product/api", () => ({
  useProducts: () => ({
    data: { items: [singleVariantProduct, multiVariantProduct, drinkProduct], total: 3, page: 1, pageSize: 100 },
    isLoading: false,
  }),
}));

// Three categories, only two of which actually have a product above — "Десерты" is deliberately
// empty to test that an empty category never renders a heading with nothing under it. Order here
// is what the API would already return (pre-sorted by sortOrder) — PosMenu must preserve it, not
// re-sort.
vi.mock("@/entities/category/api", () => ({
  useCategories: () => ({
    data: [
      { id: "cat-1", name: "Прочее" },
      { id: "cat-2", name: "Напитки" },
      { id: "cat-3", name: "Десерты" },
    ],
  }),
}));

import { PosMenu } from "./PosMenu";

describe("PosMenu — Cashier multi-variant UX", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [], tableId: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("single-variant tile: tap adds the item directly, no dialog opens", async () => {
    const user = userEvent.setup();
    render(<PosMenu />);

    await user.click(screen.getByRole("button", { name: "Лаваш" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useCartStore.getState().lines).toEqual([
      expect.objectContaining({ variantId: "variant-single", quantity: 1 }),
    ]);
  });

  it("multi-variant tile: tap opens the picker and adds nothing yet", async () => {
    const user = userEvent.setup();
    render(<PosMenu />);

    await user.click(screen.getByRole("button", { name: "Хот-дог" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(useCartStore.getState().lines).toEqual([]);
  });

  it("selecting a variant adds the correct variantId/price/name and closes the picker", async () => {
    const user = userEvent.setup();
    render(<PosMenu />);

    await user.click(screen.getByRole("button", { name: "Хот-дог" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByText("Большой"));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useCartStore.getState().lines).toEqual([
      expect.objectContaining({
        variantId: "variant-large",
        unitPrice: "18000",
        productName: "Хот-дог",
        variantLabel: "Большой",
        quantity: 1,
      }),
    ]);
  });

  it("closing the picker (Escape) adds nothing", async () => {
    const user = userEvent.setup();
    render(<PosMenu />);

    await user.click(screen.getByRole("button", { name: "Хот-дог" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(useCartStore.getState().lines).toEqual([]);
  });

  it("cart quantity increments on repeated taps of the same single-variant tile, without duplicating the line", async () => {
    const user = userEvent.setup();
    render(<PosMenu />);

    const tile = screen.getByRole("button", { name: "Лаваш" });
    await user.click(tile);
    await user.click(tile);
    await user.click(tile);

    const lines = useCartStore.getState().lines;
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual(expect.objectContaining({ variantId: "variant-single", quantity: 3 }));
  });

  it("picking two different variants of the same product creates two separate cart lines, not merged", async () => {
    const user = userEvent.setup();
    render(<PosMenu />);

    await user.click(screen.getByRole("button", { name: "Хот-дог" }));
    await user.click(within(screen.getByRole("dialog")).getByText("Маленький"));

    await user.click(screen.getByRole("button", { name: "Хот-дог" }));
    await user.click(within(screen.getByRole("dialog")).getByText("Большой"));

    const lines = useCartStore.getState().lines;
    expect(lines).toHaveLength(2);
    expect(lines.map((l) => l.variantId).sort()).toEqual(["variant-large", "variant-small"]);
    lines.forEach((l) => expect(l.quantity).toBe(1));
  });

  it("main grid never shows individual variant labels/pills for a multi-variant product", () => {
    render(<PosMenu />);

    // The picker is closed by default — variant labels must not be reachable until the tile is
    // tapped; the tile itself shows only the product name + a price range.
    expect(screen.queryByText("Маленький")).not.toBeInTheDocument();
    expect(screen.queryByText("Большой")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Хот-дог" })).toBeInTheDocument();
  });

  it("never renders an <img> on the Cashier screen, dialog included", async () => {
    const user = userEvent.setup();
    const { container } = render(<PosMenu />);
    await user.click(screen.getByRole("button", { name: "Хот-дог" }));

    expect(container.querySelectorAll("img")).toHaveLength(0);
  });
});

describe("PosMenu — category grouping (Barchasi/Все)", () => {
  beforeEach(() => {
    useCartStore.setState({ lines: [], tableId: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("Barchasi shows a heading per category, each with only its own products", () => {
    render(<PosMenu />);

    const sections = screen.getAllByRole("heading", { level: 2 });
    const headingNames = sections.map((h) => h.textContent);
    // "Десерты" has no products in these fixtures — must not appear at all.
    expect(headingNames).toEqual(["Прочее", "Напитки"]);

    const prochee = screen.getByRole("heading", { name: "Прочее" }).closest("section")!;
    expect(within(prochee).getByRole("button", { name: "Лаваш" })).toBeInTheDocument();
    expect(within(prochee).getByRole("button", { name: "Хот-дог" })).toBeInTheDocument();
    expect(within(prochee).queryByRole("button", { name: "Cola" })).not.toBeInTheDocument();

    const napitki = screen.getByRole("heading", { name: "Напитки" }).closest("section")!;
    expect(within(napitki).getByRole("button", { name: "Cola" })).toBeInTheDocument();
    expect(within(napitki).queryByRole("button", { name: "Лаваш" })).not.toBeInTheDocument();
  });

  it("an empty category never renders a heading (it can still appear as a category filter button)", () => {
    render(<PosMenu />);
    expect(screen.queryByRole("heading", { name: "Десерты" })).not.toBeInTheDocument();
    // The filter button itself legitimately lists every category regardless of product count.
    expect(screen.getByRole("button", { name: "Десерты" })).toBeInTheDocument();
  });

  it("selecting a specific category shows only its products, no headings, no grouping", async () => {
    const user = userEvent.setup();
    render(<PosMenu />);

    await user.click(screen.getByRole("button", { name: "Напитки" }));

    expect(screen.queryAllByRole("heading", { level: 2 })).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Cola" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Лаваш" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Хот-дог" })).not.toBeInTheDocument();
  });

  it("search within Barchasi keeps results grouped by category and hides categories with no match", async () => {
    const user = userEvent.setup();
    render(<PosMenu />);

    await user.type(screen.getByPlaceholderText(/Поиск товаров/i), "лав"); // matches only "Лаваш"

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Прочее"]);
    expect(screen.getByRole("button", { name: "Лаваш" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Хот-дог" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cola" })).not.toBeInTheDocument();
  });

  it("multi-variant selector still works from within a grouped section", async () => {
    const user = userEvent.setup();
    render(<PosMenu />);

    await user.click(screen.getByRole("button", { name: "Хот-дог" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByText("Большой"));

    expect(useCartStore.getState().lines).toEqual([
      expect.objectContaining({ variantId: "variant-large", quantity: 1 }),
    ]);
  });
});
