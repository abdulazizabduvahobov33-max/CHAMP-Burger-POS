import { useState } from "react";
import { ClipboardList, Pencil, Plus, Search, ShoppingBasket, Tags, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCategories } from "@/entities/category/api";
import { formatPriceRange } from "@/entities/product/lib";
import { useDeleteProduct, useProducts, useUpdateProduct } from "@/entities/product/api";
import { SALE_TYPE_LABELS, SALE_TYPE_OPTIONS, type Product, type SaleType } from "@/entities/product/model";
import { ProductImage } from "@/entities/product/ui/ProductImage";
import { CategoryManageDialog } from "@/features/category-manage/CategoryManageDialog";
import { ProductFormDialog } from "@/features/product-form/ProductFormDialog";
import { RecipeDialog } from "@/features/recipe-manage/RecipeDialog";
import { useDebouncedValue } from "@/shared/lib/useDebouncedValue";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { SkeletonProductCard } from "@/shared/ui/Skeleton";
import { Pagination } from "@/shared/ui/Pagination";

const PAGE_SIZE = 12;

export function ProductsTable() {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saleType, setSaleType] = useState<SaleType | "">("");
  const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
  const [page, setPage] = useState(1);
  const search = useDebouncedValue(searchInput);

  const { data: categories } = useCategories();
  const { data, isLoading, isError } = useProducts({
    search,
    categoryId: categoryId || undefined,
    saleType: saleType || undefined,
    isActive: activeFilter === "" ? undefined : activeFilter === "true",
    page,
    pageSize: PAGE_SIZE,
  });

  const [formTarget, setFormTarget] = useState<Product | null | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [recipeTarget, setRecipeTarget] = useState<Product | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);

  const deleteMutation = useDeleteProduct();

  function resetToFirstPage<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setPage(1);
    };
  }

  return (
    <div className="rounded-card bg-ink-card shadow-card">
      <div className="flex flex-col gap-3 border-b border-ink-line p-4 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                value={searchInput}
                onChange={(e) => resetToFirstPage(setSearchInput)(e.target.value)}
                placeholder={t("product.searchPlaceholder")}
                aria-label={t("product.searchPlaceholder")}
                className="input pl-9"
              />
            </div>

            <select
              value={categoryId}
              onChange={(e) => resetToFirstPage(setCategoryId)(e.target.value)}
              className="input sm:w-44"
            >
              <option value="">{t("product.allCategories")}</option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={saleType}
              onChange={(e) => resetToFirstPage(setSaleType)(e.target.value as SaleType | "")}
              className="input sm:w-40"
            >
              <option value="">{t("product.allSaleTypes")}</option>
              {SALE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(SALE_TYPE_LABELS[option])}
                </option>
              ))}
            </select>

            <select
              value={activeFilter}
              onChange={(e) => resetToFirstPage(setActiveFilter)(e.target.value as "" | "true" | "false")}
              className="input sm:w-36"
            >
              <option value="">{t("product.allStatuses")}</option>
              <option value="true">{t("product.statusActive")}</option>
              <option value="false">{t("product.statusHidden")}</option>
            </select>
          </div>

          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setCategoriesOpen(true)}
              className="flex items-center justify-center gap-2 rounded-xl border border-ink-line px-4 py-2.5 text-sm font-medium text-white/70 transition hover:text-white"
            >
              <Tags className="h-4 w-4" />
              {t("product.categories")}
            </button>
            <button
              type="button"
              onClick={() => setFormTarget(null)}
              className="flex items-center justify-center gap-2 rounded-xl bg-champ px-4 py-2.5 text-sm font-bold text-onaccent transition hover:bg-champ-hover"
            >
              <Plus className="h-4 w-4" />
              {t("product.addProduct")}
            </button>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonProductCard key={i} />
          ))}
        </div>
      )}
      {isError && <p className="px-6 py-10 text-center text-sm text-danger-soft">{t("product.loadError")}</p>}
      {data && data.items.length === 0 && (
        <EmptyState
          icon={ShoppingBasket}
          title={search || categoryId || saleType || activeFilter ? t("common.noResultsTitle") : t("product.emptyTitle")}
          description={
            search || categoryId || saleType || activeFilter
              ? t("common.noResultsDescription")
              : t("product.emptyDescription")
          }
          action={
            search || categoryId || saleType || activeFilter
              ? undefined
              : { label: t("product.addProduct"), icon: Plus, onClick: () => setFormTarget(null) }
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 sm:p-6 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={() => setFormTarget(product)}
                onDelete={() => setDeleteTarget(product)}
                onRecipe={() => setRecipeTarget(product)}
              />
            ))}
          </div>

          <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPageChange={setPage} />
        </>
      )}

      <ProductFormDialog open={formTarget !== undefined} onClose={() => setFormTarget(undefined)} product={formTarget} />
      <CategoryManageDialog open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      <RecipeDialog open={recipeTarget !== null} onClose={() => setRecipeTarget(null)} product={recipeTarget} />
      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("product.deleteTitle")}
        description={t("product.deleteDescription", { name: deleteTarget?.name })}
        confirmLabel={t("common.delete")}
        danger
        pending={deleteMutation.isPending}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteMutation.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </div>
  );
}

function ProductCard({
  product,
  onEdit,
  onDelete,
  onRecipe,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onRecipe: () => void;
}) {
  const { t } = useTranslation();
  const updateMutation = useUpdateProduct(product.id);

  return (
    <div
      className={`overflow-hidden rounded-xl border border-ink-line bg-ink-soft transition duration-200 hover:border-champ/40 hover:shadow-card ${
        !product.isActive ? "opacity-50" : ""
      }`}
    >
      <ProductImage src={product.imageUrl} alt={product.name} className="h-36" />
      <div className="p-4">
        <p className="text-xs text-white/40">{product.categoryName}</p>
        <p className="mt-0.5 font-medium text-white">{product.name}</p>
        <p className="mt-1 text-sm font-semibold text-champ">{formatPriceRange(product.variants)}</p>
        <p className="mt-1 text-xs text-white/30">{t(SALE_TYPE_LABELS[product.saleType])}</p>

        <div className="mt-3 flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-white/50">
            <input
              type="checkbox"
              checked={product.isActive}
              onChange={(e) => updateMutation.mutate({ isActive: e.target.checked })}
              disabled={updateMutation.isPending}
              className="h-4 w-4 rounded border-ink-line bg-ink-soft accent-champ disabled:cursor-not-allowed disabled:opacity-50"
            />
            {product.isActive ? t("product.statusActive") : t("product.statusHidden")}
          </label>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={onRecipe}
              aria-label={t("product.recipe")}
              title={t("product.recipe")}
              className="rounded-lg p-2.5 text-white/50 transition hover:bg-ink-line hover:text-white"
            >
              <ClipboardList className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onEdit}
              aria-label={t("common.edit")}
              className="rounded-lg p-2.5 text-white/50 transition hover:bg-ink-line hover:text-white"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              aria-label={t("common.delete")}
              className="rounded-lg p-2.5 text-white/50 transition hover:bg-ink-line hover:text-danger-soft"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
