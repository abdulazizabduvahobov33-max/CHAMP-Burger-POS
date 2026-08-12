import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { ImagePlus, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useCategories } from "@/entities/category/api";
import { deleteProductImage, uploadProductImage, useCreateProduct, useUpdateProduct } from "@/entities/product/api";
import { SALE_TYPE_LABELS, SALE_TYPE_OPTIONS, type Product, type SaleType } from "@/entities/product/model";
import { getErrorMessage } from "@/shared/lib/errors";
import { resolveUploadUrl } from "@/shared/lib/uploads";
import { toast } from "@/shared/stores/toastStore";
import { Dialog } from "@/shared/ui/Dialog";

type VariantRow = { id?: string; label: string; price: string };

const EMPTY_VARIANT: VariantRow = { label: "", price: "" };

// A WEIGHT product is stored exactly like any other — one ProductVariant row — but the *admin*
// only ever sees/edits a single "price per kg" field, not a general label+price list; this fixed
// label is what actually gets saved as that row's `label`, matching the convention every seeded
// weight product (KFS, Мороженое на вес) already uses. Changing this string would only rename
// future products' variant label, never break anything reading `saleType` (which is the real
// signal every weight-aware display uses — see entities/product/lib.ts's formatSaleQuantity).
const WEIGHT_VARIANT_LABEL = "1 кг";

type ProductFormDialogProps = {
  open: boolean;
  onClose: () => void;
  product?: Product | null;
};

export function ProductFormDialog({ open, onClose, product }: ProductFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(product);
  const [name, setName] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saleType, setSaleType] = useState<SaleType>("UNIT");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantRow[]>([EMPTY_VARIANT]);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The image the product had (or null) when the dialog opened — anything imageUrl
  // holds that differs from this is a fresh upload not yet attached to any product.
  const initialImageUrlRef = useRef<string | null>(null);

  const { data: categories } = useCategories();
  const createMutation = useCreateProduct();
  const updateMutation = useUpdateProduct(product?.id ?? "");
  const mutation = isEdit ? updateMutation : createMutation;

  useEffect(() => {
    if (!open) return;
    setName(product?.name ?? "");
    setCategoryId(product?.categoryId ?? "");
    setSaleType(product?.saleType ?? "UNIT");
    setImageUrl(product?.imageUrl ?? null);
    initialImageUrlRef.current = product?.imageUrl ?? null;
    setVariants(product?.variants.map((v) => ({ id: v.id, label: v.label, price: v.price })) ?? [EMPTY_VARIANT]);
    setImageError(null);
    mutation.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product]);

  // Collapses to exactly one row the moment "Весовой" is selected — whether that's from loading
  // an existing weight product (the row is already normalized, this is a no-op) or the admin
  // just switching the dropdown while multiple UNIT-style variant rows are still in state, which
  // would otherwise silently keep those extra rows around, submitting several priced "variants"
  // for what the single-price UI below only shows/edits one of.
  useEffect(() => {
    if (saleType !== "WEIGHT") return;
    setVariants((rows) => {
      if (rows.length === 1 && rows[0].label === WEIGHT_VARIANT_LABEL) return rows;
      return [{ id: rows[0]?.id, label: WEIGHT_VARIANT_LABEL, price: rows[0]?.price ?? "" }];
    });
  }, [saleType]);

  function isUnsavedUpload(url: string | null): url is string {
    return url !== null && url !== initialImageUrlRef.current;
  }

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setImageUploading(true);
    setImageError(null);
    try {
      const url = await uploadProductImage(file);
      if (isUnsavedUpload(imageUrl)) {
        void deleteProductImage(imageUrl);
      }
      setImageUrl(url);
    } catch (err) {
      setImageError(getErrorMessage(err, t("product.form.imageUploadFailed")));
    } finally {
      setImageUploading(false);
    }
  }

  function handleRemoveImage() {
    if (isUnsavedUpload(imageUrl)) {
      void deleteProductImage(imageUrl);
    }
    setImageUrl(null);
  }

  function handleCancel() {
    if (isUnsavedUpload(imageUrl)) {
      void deleteProductImage(imageUrl);
    }
    onClose();
  }

  function updateVariant(index: number, patch: Partial<VariantRow>) {
    setVariants((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addVariant() {
    setVariants((rows) => [...rows, EMPTY_VARIANT]);
  }

  function removeVariant(index: number) {
    setVariants((rows) => rows.filter((_, i) => i !== index));
  }

  const validVariants = variants
    .map((v) => ({ id: v.id, label: v.label.trim(), price: v.price }))
    .filter((v) => v.label && v.price !== "");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (validVariants.length === 0) return;

    mutation.mutate(
      {
        name: name.trim(),
        categoryId,
        saleType,
        imageUrl,
        variants: validVariants.map((v) => ({ id: v.id, label: v.label, price: Number(v.price) })),
      },
      {
        onSuccess: () => {
          toast.success(isEdit ? t("product.form.updateSuccess") : t("product.form.createSuccess"));
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onClose={handleCancel}
      title={isEdit ? t("product.form.editTitle") : t("product.form.createTitle")}
      widthClassName="max-w-lg"
    >
      <form onSubmit={handleSubmit} className="max-h-[75vh] space-y-4 overflow-y-auto pr-1">
        <div className="flex items-start gap-4">
          <div className="shrink-0">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-xl border border-ink-line bg-ink-soft">
              {imageUrl ? (
                <img src={resolveUploadUrl(imageUrl) as string} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-6 w-6 text-white/20" />
              )}
            </div>
          </div>
          <div className="flex-1">
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              {t("product.form.photo")}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={imageUploading}
                className="rounded-xl border border-ink-line px-3 py-1.5 text-xs font-medium text-white/70 transition hover:text-white disabled:opacity-50"
              >
                {imageUploading
                  ? t("product.form.uploading")
                  : imageUrl
                    ? t("product.form.replace")
                    : t("product.form.upload")}
              </button>
              {imageUrl && (
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="rounded-xl border border-ink-line px-3 py-1.5 text-xs font-medium text-white/50 transition hover:text-danger-soft"
                >
                  {t("product.form.remove")}
                </button>
              )}
            </div>
            {imageError && <p className="mt-1.5 text-xs text-danger-soft">{imageError}</p>}
            <p className="mt-1.5 text-xs text-white/30">{t("product.form.photoHint")}</p>
          </div>
        </div>

        <Field label={t("product.form.name")}>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={120} className="input" />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label={t("product.form.category")}>
            <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} required className="input">
              <option value="" disabled>
                {t("product.form.selectPlaceholder")}
              </option>
              {categories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label={t("product.form.saleType")}>
            <select value={saleType} onChange={(e) => setSaleType(e.target.value as SaleType)} className="input">
              {SALE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {t(SALE_TYPE_LABELS[option])}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {saleType === "WEIGHT" ? (
          <Field label={t("product.form.pricePerKg")}>
            <div className="relative">
              <input
                type="number"
                min={0}
                step="0.01"
                value={variants[0]?.price ?? ""}
                onChange={(e) => updateVariant(0, { label: WEIGHT_VARIANT_LABEL, price: e.target.value })}
                placeholder={t("product.form.variantPricePlaceholder")}
                className="input pr-14"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-white/40">
                {t("pos.weight.perKgSuffix")}
              </span>
            </div>
            {validVariants.length === 0 && (
              <p className="mt-2 text-xs text-danger-soft">{t("product.form.priceRequired")}</p>
            )}
          </Field>
        ) : (
          <div>
            <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
              {t("product.form.variants")}
            </span>
            <div className="space-y-2">
              {variants.map((row, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={row.label}
                    onChange={(e) => updateVariant(i, { label: e.target.value })}
                    placeholder={t("product.form.variantLabelPlaceholder")}
                    className="input flex-1"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={row.price}
                    onChange={(e) => updateVariant(i, { price: e.target.value })}
                    placeholder={t("product.form.variantPricePlaceholder")}
                    className="input w-28"
                  />
                  <button
                    type="button"
                    onClick={() => removeVariant(i)}
                    disabled={variants.length <= 1}
                    aria-label={t("product.form.removeVariant")}
                    className="shrink-0 rounded-lg p-2 text-white/40 transition hover:text-danger-soft disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addVariant}
              className="mt-2 flex items-center gap-1.5 text-xs font-medium text-champ transition hover:text-champ-hover"
            >
              <Plus className="h-3.5 w-3.5" />
              {t("product.form.addVariant")}
            </button>
            {validVariants.length === 0 && (
              <p className="mt-2 text-xs text-danger-soft">{t("product.form.variantsRequired")}</p>
            )}
          </div>
        )}

        {mutation.isError && (
          <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger-soft">
            {getErrorMessage(mutation.error, t("common.saveFailed"))}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-xl border border-ink-line px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white"
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={mutation.isPending || !name.trim() || !categoryId || validVariants.length === 0}
            className="rounded-xl bg-champ px-5 py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {mutation.isPending ? t("common.saving") : isEdit ? t("common.save") : t("common.create")}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">{label}</span>
      {children}
    </label>
  );
}
