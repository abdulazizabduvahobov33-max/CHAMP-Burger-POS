import { memo, useCallback, useRef, useState } from "react";
import { Check, Search, UtensilsCrossed, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCategories } from "@/entities/category/api";
import { useProducts } from "@/entities/product/api";
import { formatPrice } from "@/entities/product/lib";
import type { Product, ProductVariant } from "@/entities/product/model";
import { ProductImage } from "@/entities/product/ui/ProductImage";
import { useDebouncedValue } from "@/shared/lib/useDebouncedValue";
import { useCartStore } from "@/shared/stores/cartStore";
import { useWeightEntryStore } from "@/shared/stores/weightEntryStore";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Pagination } from "@/shared/ui/Pagination";
import { SkeletonProductCard } from "@/shared/ui/Skeleton";

const PAGE_SIZE = 24;

export function PosMenu() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput);

  const { data: categories } = useCategories();
  // Filtering happens server-side (like every other module's table) so the menu never silently
  // truncates once a location's catalog outgrows a single page — see Module 4's ProductsTable.
  const { data, isLoading } = useProducts({ search, categoryId: categoryId || undefined, isActive: true, page, pageSize: PAGE_SIZE });
  const addItem = useCartStore((s) => s.addItem);
  const openWeightEntry = useWeightEntryStore((s) => s.open);

  const products = data?.items ?? [];

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  // A WEIGHT product never goes straight into the cart on tap — the price depends on how much of
  // it is being sold, which nobody knows yet at click time. Opens the weight dialog instead (see
  // shared/stores/weightEntryStore.ts); if this exact variant is already in the cart, pre-fills
  // the dialog with its current weight so re-tapping the card is how you *adjust* an amount
  // already added, not how you add a confusing second line for the same product.
  //
  // One stable callback for every card (useCallback, deps are the two Zustand action functions —
  // stable for the store's lifetime) instead of a fresh closure bound to each product per render
  // — that's what actually lets PosProductCard below skip re-rendering when nothing about IT
  // changed. Reads the cart's current lines via getState() at tap time rather than a reactive
  // useCartStore(s => s.lines) subscription — same result (this only ever runs from a click, a
  // point-in-time read), but it means PosMenu itself no longer re-renders (and cascades a
  // re-render into all ~24 visible cards) every time any item is added to or edited in the cart,
  // which it previously did on every single tap regardless of which product was tapped.
  const handleCardTap = useCallback(
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
            onChange={(e) => resetToFirstPage(setSearchInput)(e.target.value)}
            placeholder={t("pos.searchPlaceholder")}
            aria-label={t("pos.searchPlaceholder")}
            className="input pl-9 pr-9"
            autoFocus
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => resetToFirstPage(setSearchInput)("")}
              aria-label={t("common.close")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/30 transition hover:bg-ink-line hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          <CategoryPill active={categoryId === ""} onClick={() => resetToFirstPage(setCategoryId)("")}>
            {t("pos.allCategories")}
          </CategoryPill>
          {categories?.map((c) => (
            <CategoryPill key={c.id} active={categoryId === c.id} onClick={() => resetToFirstPage(setCategoryId)(c.id)}>
              {c.name}
            </CategoryPill>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {isLoading && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <SkeletonProductCard key={i} />
            ))}
          </div>
        )}

        {!isLoading && products.length === 0 && (
          <EmptyState
            icon={UtensilsCrossed}
            title={search || categoryId ? t("common.noResultsTitle") : t("pos.emptyTitle")}
            description={search || categoryId ? t("common.noResultsDescription") : t("pos.emptyDescription")}
          />
        )}

        {!isLoading && products.length > 0 && (
          <div key={`${search}-${categoryId}-${page}`} className="grid animate-fade-in grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product) => (
              <PosProductCard key={product.id} product={product} onTap={handleCardTap} />
            ))}
          </div>
        )}
      </div>

      {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />}
    </div>
  );
}

function CategoryPill({
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
      className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition ${
        active ? "bg-champ text-onaccent shadow-card" : "bg-ink-soft text-white/60 hover:bg-ink-line hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

// Memoized so a PosMenu re-render for a reason that has nothing to do with this specific card
// (search input still debouncing, the cart changing, another card's own "just added" flash) skips
// it entirely — React's default shallow-compares `product` (stable across re-renders that don't
// actually refetch the product list — React Query keeps the same object reference) and `onTap`
// (now a single stable useCallback shared by every card, see PosMenu above), so this only
// actually re-renders when the product it displays genuinely changed.
const PosProductCard = memo(function PosProductCard({
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
    // A WEIGHT tap opens the weight dialog (see PosMenu's handleCardTap) instead of adding
    // anything immediately — the checkmark flash belongs to an item that just landed in the
    // cart, which hasn't happened yet here.
    if (isWeight) return;
    setJustAdded(true);
    window.clearTimeout(flashTimeoutRef.current);
    flashTimeoutRef.current = window.setTimeout(() => setJustAdded(false), 600);
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-ink-soft transition duration-200 hover:-translate-y-1 hover:border-champ/50 hover:shadow-card ${
        justAdded ? "border-champ shadow-card" : "border-ink-line"
      }`}
    >
      <button
        type="button"
        onClick={singleVariant ? () => handleAdd(singleVariant) : undefined}
        disabled={!singleVariant}
        aria-label={product.name}
        className={`relative block w-full ${singleVariant ? "cursor-pointer active:scale-95" : ""} transition`}
      >
        <ProductImage src={product.imageUrl} alt={product.name} className="h-32 sm:h-36 lg:h-40" />
        <div
          className={`absolute inset-0 flex items-center justify-center bg-ink/70 transition-opacity duration-300 ${
            justAdded ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <span className={`flex h-11 w-11 items-center justify-center rounded-full bg-success text-onaccent shadow-card transition-transform duration-300 ${justAdded ? "scale-100" : "scale-50"}`}>
            <Check className="h-6 w-6" />
          </span>
        </div>
      </button>

      <div className="p-3.5">
        <p className="truncate text-sm font-semibold text-white">{product.name}</p>

        {singleVariant ? (
          <button
            type="button"
            onClick={() => handleAdd(singleVariant)}
            className="mt-2 w-full rounded-xl bg-champ/15 py-2 text-sm font-bold text-champ transition hover:bg-champ hover:text-onaccent active:scale-95"
          >
            {formatPrice(singleVariant.price)}
            {isWeight && <span className="text-champ/60"> {t("pos.weight.perKgSuffix")}</span>}
          </button>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {product.variants.map((v) => {
              // Seed data often uses the price itself as the variant label (e.g. "20 000");
              // showing both would just repeat the same number — only pair them up when the
              // label actually carries extra information (a real size/name, not the price again).
              const isLabelJustThePrice = v.label.replace(/\s/g, "") === formatPrice(v.price).replace(/\s/g, "");
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => handleAdd(v)}
                  className="rounded-lg bg-champ/15 px-2.5 py-1.5 text-xs font-bold text-champ transition hover:bg-champ hover:text-onaccent active:scale-95"
                >
                  {isLabelJustThePrice ? formatPrice(v.price) : `${v.label} · ${formatPrice(v.price)}`}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
