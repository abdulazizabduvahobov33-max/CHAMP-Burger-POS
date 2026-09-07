import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Search, UtensilsCrossed, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCategories } from "@/entities/category/api";
import { useProducts } from "@/entities/product/api";
import { formatPrice, formatPriceRange } from "@/entities/product/lib";
import type { Product, ProductVariant } from "@/entities/product/model";
import { Dialog } from "@/shared/ui/Dialog";
import { useCartStore } from "@/shared/stores/cartStore";
import { useWeightEntryStore } from "@/shared/stores/weightEntryStore";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ErrorState } from "@/shared/ui/ErrorState";
import { SkeletonPosTile } from "@/shared/ui/Skeleton";

// The cashier screen is deliberately architected differently from ProductsTable's server-side
// paginated search: it loads the whole active catalog ONCE (100 is the API's own page-size
// ceiling — see server/src/modules/products/product.schema.ts — comfortably above this client's
// real menu size) and filters/searches locally from then on, so switching category or typing a
// search never fires a network request. Product photos are also never rendered here at all (no
// <ProductImage> anywhere in this file) — see PosProductTile below — so the browser makes zero
// image requests on this screen, regardless of catalog size.
const CATALOG_PAGE_SIZE = 100;

// Tuned for the actual tablet range (~600-1100px), not just Tailwind's default sm/md/lg jumps
// (640/768/1024/1280) — those land awkwardly on real device widths (e.g. a 1024-wide landscape
// tablet sits exactly on the lg boundary). Combined with the tile itself having no forced aspect
// ratio (see PosProductTile), more columns at a given width means each one gets narrower instead
// of the tile staying square and growing tall — that's what actually fixes "cards too big on
// tablet", not the column count alone.
const GRID_CLASSNAME =
  "grid grid-cols-2 gap-2.5 min-[500px]:grid-cols-3 min-[700px]:grid-cols-4 min-[900px]:grid-cols-5 min-[1100px]:grid-cols-6 sm:gap-3";

export function PosMenu() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [categoryId, setCategoryId] = useState("");
  // Which multi-variant product's picker is open — null means closed. Owned here (not inside a
  // tile) because exactly one picker can be open at a time regardless of which tile opened it.
  const [variantPickerProduct, setVariantPickerProduct] = useState<Product | null>(null);

  const { data: categories } = useCategories();
  const { data, isLoading, isError, refetch } = useProducts({ isActive: true, page: 1, pageSize: CATALOG_PAGE_SIZE });
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

  // Only grouped in the "Все" view (no specific category picked) — a single category's own grid
  // is already homogeneous, grouping it would just print one redundant heading. Category order
  // and each category's product order both come pre-sorted by sortOrder from the API (same
  // ordering already used for the category pills and for a single-category grid) — grouping here
  // is purely a re-bucketing of the already-filtered `products` array, never a re-sort. Empty
  // categories (no match, e.g. after a search) are dropped rather than shown with nothing under
  // the heading.
  const groups = useMemo(() => {
    if (categoryId || !categories) return null;
    const byCategory = new Map<string, Product[]>();
    for (const p of products) {
      const list = byCategory.get(p.categoryId);
      if (list) list.push(p);
      else byCategory.set(p.categoryId, [p]);
    }
    return categories
      .map((c) => ({ category: c, products: byCategory.get(c.id) ?? [] }))
      .filter((g) => g.products.length > 0);
  }, [products, categories, categoryId]);

  // A WEIGHT product never goes straight into the cart on tap — the price depends on how much of
  // it is being sold, which nobody knows yet at click time. Opens the weight dialog instead (see
  // shared/stores/weightEntryStore.ts); if this exact variant is already in the cart, pre-fills
  // the dialog with its current weight so re-tapping the tile is how you *adjust* an amount
  // already added, not how you add a confusing second line for the same product. This is the one
  // handler that actually adds/opens-for a specific, already-decided variant — both the
  // single-variant tile (tap = the only variant) and the picker dialog (tap = the chosen variant)
  // call this exact same function, so a WEIGHT product behaves identically either way.
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

  // A multi-variant tile can't tap-to-add directly (which price would apply is ambiguous) — it
  // opens this picker instead. Stable across renders for the same memoization reason as
  // handleTap above.
  const handleOpenPicker = useCallback((product: Product) => {
    setVariantPickerProduct(product);
  }, []);

  const handleVariantSelect = useCallback(
    (variant: ProductVariant) => {
      if (!variantPickerProduct) return;
      handleTap(variantPickerProduct, variant);
      setVariantPickerProduct(null);
    },
    [variantPickerProduct, handleTap],
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-ink-line p-3 sm:p-4">
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

        <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-1 sm:mt-3 sm:gap-2">
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

      <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
        {isLoading && (
          <div className={GRID_CLASSNAME}>
            {Array.from({ length: 12 }).map((_, i) => (
              <SkeletonPosTile key={i} />
            ))}
          </div>
        )}

        {/* Checked BEFORE the empty-state branch below — on a failed fetch, `products` is also
            an empty array, and rendering the empty-catalog message in that case would tell a
            cashier "there are no products" when the real problem is a network/server error
            (cold start, timeout, ...). That's a strictly worse UX than an honest error+retry: a
            silent lie instead of an explained failure. */}
        {!isLoading && isError && <ErrorState message={t("pos.menuLoadError")} onRetry={() => void refetch()} />}

        {!isLoading && !isError && products.length === 0 && (
          <EmptyState
            icon={UtensilsCrossed}
            title={searchInput || categoryId ? t("common.noResultsTitle") : t("pos.emptyTitle")}
            description={searchInput || categoryId ? t("common.noResultsDescription") : t("pos.emptyDescription")}
          />
        )}

        {!isLoading && !isError && groups && groups.length > 0 && (
          <div className="space-y-5 sm:space-y-6">
            {groups.map(({ category, products: categoryProducts }) => (
              <section key={category.id}>
                <h2 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-white/50 sm:mb-3 sm:text-sm">
                  {category.name}
                </h2>
                <div className={GRID_CLASSNAME}>
                  {categoryProducts.map((product) => (
                    <PosProductTile key={product.id} product={product} onTap={handleTap} onOpenPicker={handleOpenPicker} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {!isLoading && !groups && products.length > 0 && (
          <div className={GRID_CLASSNAME}>
            {products.map((product) => (
              <PosProductTile key={product.id} product={product} onTap={handleTap} onOpenPicker={handleOpenPicker} />
            ))}
          </div>
        )}
      </div>

      <VariantPickerDialog
        product={variantPickerProduct}
        onSelect={handleVariantSelect}
        onClose={() => setVariantPickerProduct(null)}
      />
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
      className={`shrink-0 rounded-xl px-3.5 py-2.5 text-xs font-bold transition active:scale-95 sm:px-5 sm:py-3 sm:text-sm ${
        active ? "bg-champ text-onaccent" : "bg-ink-soft text-white/70"
      }`}
    >
      {children}
    </button>
  );
}

// Memoized so a PosMenu re-render for a reason that has nothing to do with this specific tile
// (search input changing, the cart changing, another tile's own "just added" flash, the picker
// dialog opening for a DIFFERENT product) skips it entirely — React's default shallow-compares
// `product` (stable across re-renders that don't actually refetch the product list — React Query
// keeps the same object reference) and `onTap`/`onOpenPicker` (single stable useCallbacks shared
// by every tile, see PosMenu above), so this only actually re-renders when the product it
// displays genuinely changed.
//
// Deliberately no <ProductImage>, no hover-lift/shadow, no backdrop-blur — this screen is used on
// shared tablets/monoblocks for hours at a time, so every tile in the grid stays as cheap as
// possible to paint. The only transition here is a plain 150ms border/background color swap for
// the tap flash and a `active:scale-95` press feedback, both compositor-cheap.
//
// Deliberately NO aspect-square / fixed height: a tile's height comes from its own content
// (name capped at 2 lines + one price line, both via a modest min-height for a comfortable touch
// target) instead of being forced to match its column's width. That decoupling is what actually
// keeps tiles compact on tablet widths — more columns there means each one gets NARROWER, not
// square-and-therefore-taller.
const PosProductTile = memo(function PosProductTile({
  product,
  onTap,
  onOpenPicker,
}: {
  product: Product;
  onTap: (product: Product, variant: ProductVariant) => void;
  onOpenPicker: (product: Product) => void;
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
  // button, tap anywhere = add 1 (or open the weight dialog, for a WEIGHT product).
  if (singleVariant) {
    return (
      <button
        type="button"
        onClick={() => handleAdd(singleVariant)}
        aria-label={product.name}
        className={`flex min-h-[76px] flex-col justify-between gap-1 rounded-xl border p-2.5 text-left transition active:scale-95 sm:min-h-[86px] sm:p-3 ${
          justAdded ? "border-success bg-success/10" : "border-ink-line bg-ink-soft"
        }`}
      >
        <span className="line-clamp-2 text-sm font-bold text-white sm:text-base">{product.name}</span>
        <span className="text-base font-extrabold text-champ sm:text-lg">
          {formatPrice(singleVariant.price)}
          {isWeight && <span className="text-xs font-semibold text-champ/60"> {t("pos.weight.perKgSuffix")}</span>}
        </span>
      </button>
    );
  }

  // Multiple variants (sizes/options): which price applies is ambiguous until one is picked, so
  // the whole tile opens a picker instead of adding anything directly — no price pills inside the
  // main grid card. First choose the PRODUCT, then the variant — never the other way round.
  return (
    <button
      type="button"
      onClick={() => onOpenPicker(product)}
      aria-label={product.name}
      className="flex min-h-[76px] flex-col justify-between gap-1 rounded-xl border border-ink-line bg-ink-soft p-2.5 text-left transition active:scale-95 sm:min-h-[86px] sm:p-3"
    >
      <span className="line-clamp-2 text-sm font-bold text-white sm:text-base">{product.name}</span>
      <span className="text-base font-extrabold text-champ sm:text-lg">{formatPriceRange(product.variants)}</span>
    </button>
  );
});

/** Reuses the app's one shared Dialog (Escape, click-outside, portal, focus-on-open — see
 * shared/ui/Dialog.tsx) instead of a bespoke sheet, so this gets the same proven desktop/tablet/
 * mobile behavior as every other dialog in the app for free. Variant labels are shown exactly as
 * stored (never invented "Small/Medium/Large" — see WHY in PosMenu's spec): when a label is just
 * the price repeated (common in this menu's data), only the price is shown once, same convention
 * the old inline pills already used. */
function VariantPickerDialog({
  product,
  onSelect,
  onClose,
}: {
  product: Product | null;
  onSelect: (variant: ProductVariant) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={product !== null} onClose={onClose} title={product?.name ?? ""} widthClassName="max-w-sm">
      {product && (
        <div className="grid grid-cols-2 gap-2">
          {product.variants.map((v) => {
            const isLabelJustThePrice = v.label.replace(/\s/g, "") === formatPrice(v.price).replace(/\s/g, "");
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => onSelect(v)}
                className="rounded-xl border border-ink-line bg-ink-soft px-3 py-4 text-center transition active:scale-95 hover:border-champ/50"
              >
                {!isLabelJustThePrice && <div className="mb-1 text-sm font-medium text-white/60">{v.label}</div>}
                <div className="text-lg font-extrabold text-champ">{formatPrice(v.price)}</div>
              </button>
            );
          })}
        </div>
      )}
    </Dialog>
  );
}
