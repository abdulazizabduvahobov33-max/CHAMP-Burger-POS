import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Search, UtensilsCrossed, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCategories } from "@/entities/category/api";
import { useProducts } from "@/entities/product/api";
import { formatPrice } from "@/entities/product/lib";
import type { Product, ProductVariant } from "@/entities/product/model";
import { useCartStore } from "@/shared/stores/cartStore";
import { useWeightEntryStore } from "@/shared/stores/weightEntryStore";
import { EmptyState } from "@/shared/ui/EmptyState";
import { SkeletonPosTile } from "@/shared/ui/Skeleton";

// The cashier screen is deliberately architected differently from ProductsTable's server-side
// paginated search: it loads the whole active catalog ONCE (100 is the API's own page-size
// ceiling — see server/src/modules/products/product.schema.ts — comfortably above this client's
// real menu size) and filters/searches locally from then on, so switching category or typing a
// search never fires a network request. Product photos are also never rendered here at all (no
// <ProductImage> anywhere in this file) — see PosProductTile below — so the browser makes zero
// image requests on this screen, regardless of catalog size.
const CATALOG_PAGE_SIZE = 100;

export function PosMenu() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const { data: categories } = useCategories();
  const { data, isLoading } = useProducts({ isActive: true, page: 1, pageSize: CATALOG_PAGE_SIZE });
  const addItem = useCartStore((s) => s.addItem);
  const openWeightEntry = useWeightEntryStore((s) => s.open);

  const allProducts = data?.items ?? [];

  const products = useMemo(() => {
    const q = searchInput.trim().toLowerCase();
    if (!categoryId && !q) return allProducts;
    return allProducts.filter((p) => {
      if (categoryId && p.categoryId !== categoryId) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allProducts, categoryId, searchInput]);

  // A WEIGHT product never goes straight into the cart on tap — the price depends on how much of
  // it is being sold, which nobody knows yet at click time. Opens the weight dialog instead (see
  // shared/stores/weightEntryStore.ts); if this exact variant is already in the cart, pre-fills
  // the dialog with its current weight so re-tapping the tile is how you *adjust* an amount
  // already added, not how you add a confusing second line for the same product.
  //
  // One stable callback for every tile (useCallback, deps are the two Zustand action functions —
  // stable for the store's lifetime) instead of a fresh closure bound to each product per render
  // — that's what actually lets PosProductTile below skip re-rendering when nothing about IT
  // changed. Reads the cart's current lines via getState() at tap time rather than a reactive
  // useCartStore(s => s.lines) subscription — same result (this only ever runs from a click, a
  // point-in-time read), but it means PosMenu itself no longer re-renders (and cascades a
  // re-render into every visible tile) every time any item is added to or edited in the cart.
  const handleTap = useCallback(
    (product: Product, variant: ProductVariant) => {
      if (product.saleType === "WEIGHT") {
        const existing = useCartStore.getState().lines.find((l) => l.variantId === variant.id);
        openWeightEntry({
          variantId: variant.id,
          productId: product.id,
          productName: product.name,
          variantLabel: variant.label,
          imageUrl: product.imageUrl,
          unitPrice: variant.price,
          initialGrams: existing ? Math.round(existing.quantity * 1000) : undefined,
        });
        return;
      }
      addItem({
        variantId: variant.id,
        productId: product.id,
        productName: product.name,
        variantLabel: variant.label,
        imageUrl: product.imageUrl,
        unitPrice: variant.price,
        saleType: product.saleType,
      });
    },
    [addItem, openWeightEntry],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-ink-line p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t("pos.searchPlaceholder")}
            aria-label={t("pos.searchPlaceholder")}
            className="input pl-9 pr-9"
            autoFocus
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              aria-label={t("common.close")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/30 transition hover:bg-ink-line hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <CategoryButton active={categoryId === ""} onClick={() => setCategoryId("")}>
            {t("pos.allCategories")}
          </CategoryButton>
          {categories?.map((c) => (
            <CategoryButton key={c.id} active={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              {c.name}
            </CategoryButton>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonPosTile key={i} />
            ))}
          </div>
        )}

        {!isLoading && products.length === 0 && (
          <EmptyState
            icon={UtensilsCrossed}
            title={searchInput || categoryId ? t("common.noResultsTitle") : t("pos.emptyTitle")}
            description={searchInput || categoryId ? t("common.noResultsDescription") : t("pos.emptyDescription")}
          />
        )}

        {!isLoading && products.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {products.map((product) => (
              <PosProductTile key={product.id} product={product} onTap={handleTap} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Bigger, higher-contrast than a small pill — meant to be the fast, primary way to narrow the
// grid on a shared tablet/moноblock, not a secondary filter chip.
function CategoryButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-xl px-5 py-3 text-sm font-bold transition active:scale-95 ${
        active ? "bg-champ text-onaccent" : "bg-ink-soft text-white/70"
      }`}
    >
      {children}
    </button>
  );
}

// Memoized so a PosMenu re-render for a reason that has nothing to do with this specific tile
// (search input changing, the cart changing, another tile's own "just added" flash) skips it
// entirely — React's default shallow-compares `product` (stable across re-renders that don't
// actually refetch the product list — React Query keeps the same object reference) and `onTap`
// (a single stable useCallback shared by every tile, see PosMenu above), so this only actually
// re-renders when the product it displays genuinely changed.
//
// Deliberately no <ProductImage>, no hover-lift/shadow, no backdrop-blur — this screen is used on
// shared tablets/monoblocks for hours at a time, so every tile in the grid stays as cheap as
// possible to paint. The only transition here is a plain 150ms border/background color swap for
// the tap flash and a `active:scale-95` press feedback, both compositor-cheap.
const PosProductTile = memo(function PosProductTile({
  product,
  onTap,
}: {
  product: Product;
  onTap: (product: Product, variant: ProductVariant) => void;
}) {
  const { t } = useTranslation();
  const isWeight = product.saleType === "WEIGHT";
  const singleVariant = product.variants.length === 1 ? product.variants[0] : null;
  const [justAdded, setJustAdded] = useState(false);
  const flashTimeoutRef = useRef<number>();

  function handleAdd(variant: ProductVariant) {
    onTap(product, variant);
    // A WEIGHT tap opens the weight dialog (see PosMenu's handleTap) instead of adding anything
    // immediately — the "just added" flash belongs to an item that actually landed in the cart,
    // which hasn't happened yet here.
    if (isWeight) return;
    setJustAdded(true);
    window.clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => setJustAdded(false), 400);
  }

  // Single variant: the whole tile is one tap target — no separate "+" button, no separate price
  // button, tap anywhere = add 1.
  if (singleVariant) {
    return (
      <button
        type="button"
        onClick={() => handleAdd(singleVariant)}
        aria-label={product.name}
        className={`flex aspect-square flex-col justify-between rounded-xl border p-3 text-left transition active:scale-95 ${
          justAdded ? "border-success bg-success/10" : "border-ink-line bg-ink-soft"
        }`}
      >
        <span className="line-clamp-3 text-base font-bold text-white sm:text-lg">{product.name}</span>
        <span className="text-lg font-extrabold text-champ sm:text-xl">
          {formatPrice(singleVariant.price)}
          {isWeight && <span className="text-xs font-semibold text-champ/60"> {t("pos.weight.perKgSuffix")}</span>}
        </span>
      </button>
    );
  }

  // Multiple variants (sizes/options): which price applies is ambiguous until one is picked, so
  // the tile itself isn't one tap target here — same lightweight inline picker as before, just
  // without a photo above it.
  return (
    <div className="flex aspect-square flex-col justify-between rounded-xl border border-ink-line bg-ink-soft p-3">
      <span className="line-clamp-2 text-sm font-bold text-white sm:text-base">{product.name}</span>
      <div className="flex flex-wrap gap-1.5">
        {product.variants.map((v) => {
          // Seed data often uses the price itself as the variant label (e.g. "20 000"); showing
          // both would just repeat the same number — only pair them up when the label actually
          // carries extra information (a real size/name, not the price again).
          const isLabelJustThePrice = v.label.replace(/\s/g, "") === formatPrice(v.price).replace(/\s/g, "");
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => handleAdd(v)}
              className="rounded-lg bg-champ/15 px-2.5 py-1.5 text-xs font-bold text-champ transition active:scale-95"
            >
              {isLabelJustThePrice ? formatPrice(v.price) : `${v.label} · ${formatPrice(v.price)}`}
            </button>
          );
        })}
      </div>
    </div>
  );
});
