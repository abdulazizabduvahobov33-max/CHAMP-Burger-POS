import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Ban, History, Pencil, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  useAddSaleItem,
  useCancelOwnerSale,
  useOwnerSaleDetail,
  useRemoveSaleItem,
  useUpdateSaleItem,
} from "@/entities/owner/api";
import type { OwnerSaleDetail, OwnerSaleItem, SaleChangeLogEntry } from "@/entities/owner/model";
import { useProducts } from "@/entities/product/api";
import { formatPrice, formatSaleQuantity } from "@/entities/product/lib";
import { dateFnsLocale } from "@/shared/lib/dateLocale";
import { getErrorMessage } from "@/shared/lib/errors";
import { toast } from "@/shared/stores/toastStore";
import { Dialog } from "@/shared/ui/Dialog";
import { Skeleton } from "@/shared/ui/Skeleton";

type OwnerSaleDetailDialogProps = {
  saleId: string | null;
  onClose: () => void;
};

/**
 * The entire reason the owner panel exists: open a finalized receipt and fix a cashier's mistake
 * in seconds — remove a wrong item, fix a quantity/price, add something that was missed, or void
 * the whole thing. Every single action here writes a permanent SaleChangeLog row server-side
 * (see owner.service.ts) instead of ever deleting anything; the "История изменений" section at
 * the bottom is that log, rendered plainly, and it only ever grows.
 */
export function OwnerSaleDetailDialog({ saleId, onClose }: OwnerSaleDetailDialogProps) {
  const { t } = useTranslation();
  const { data: sale, isLoading } = useOwnerSaleDetail(saleId);
  const [removingItem, setRemovingItem] = useState<OwnerSaleItem | null>(null);
  const [editingItem, setEditingItem] = useState<OwnerSaleItem | null>(null);
  const [addingItem, setAddingItem] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Called unconditionally (React's rules of hooks) even while saleId is momentarily null
  // (dialog closed) — the "" fallback is never actually used to build a request, since every
  // .mutate() call below is only reachable once the dialog has a loaded `sale` to act on.
  const removeItem = useRemoveSaleItem(saleId ?? "");
  const updateItem = useUpdateSaleItem(saleId ?? "");
  const addItem = useAddSaleItem(saleId ?? "");
  const cancelSale = useCancelOwnerSale(saleId ?? "");

  const correctable = sale?.status === "ACCEPTED";
  const activeItems = sale?.items.filter((i) => i.removedAt === null) ?? [];

  return (
    <>
      <Dialog
        open={saleId !== null}
        onClose={onClose}
        title={sale ? t("sale.detailTitle", { number: sale.receiptNumber }) : t("sale.detailTitleDefault")}
        widthClassName="max-w-2xl"
      >
        {isLoading && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}

        {sale && (
          <div className="max-h-[75vh] space-y-5 overflow-y-auto pr-1">
            <SaleHeader sale={sale} />

            <div className="space-y-2">
              {activeItems.map((item) => (
                <ItemRow
                  key={item.id}
                  item={item}
                  correctable={correctable}
                  onRemove={() => setRemovingItem(item)}
                  onEdit={() => setEditingItem(item)}
                />
              ))}
              {sale.items.some((i) => i.removedAt !== null) && (
                <div className="space-y-1.5 pt-1">
                  {sale.items
                    .filter((i) => i.removedAt !== null)
                    .map((item) => (
                      <RemovedItemRow key={item.id} item={item} />
                    ))}
                </div>
              )}
            </div>

            {correctable && (
              <button
                type="button"
                onClick={() => setAddingItem(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink-line py-2.5 text-sm font-medium text-white/50 transition hover:border-champ/50 hover:text-champ"
              >
                <Plus className="h-4 w-4" />
                {t("owner.addItem")}
              </button>
            )}

            <div className="flex items-center justify-between border-t border-ink-line pt-3 text-lg font-bold">
              <span className="text-white/60">{t("sale.total")}</span>
              <span className="text-champ">{formatPrice(sale.totalAmount)}</span>
            </div>

            {correctable && (
              <button
                type="button"
                onClick={() => setCancelling(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger/50 py-2.5 text-sm font-bold text-danger-soft transition hover:bg-danger/10"
              >
                <Ban className="h-4 w-4" />
                {t("owner.cancelSale")}
              </button>
            )}

            <ChangeLogSection logs={sale.changeLogs} />
          </div>
        )}
      </Dialog>

      <ReasonDialog
        open={removingItem !== null}
        title={t("owner.removeItemTitle")}
        description={removingItem ? `${removingItem.productName} ×${removingItem.quantity}` : undefined}
        confirmLabel={t("common.delete")}
        pending={removeItem.isPending}
        onClose={() => setRemovingItem(null)}
        onConfirm={(reason) => {
          if (!removingItem) return;
          removeItem.mutate(
            { itemId: removingItem.id, reason },
            {
              onSuccess: () => {
                toast.success(t("owner.removeItemSuccess"));
                setRemovingItem(null);
              },
              onError: (err) => toast.error(getErrorMessage(err, t("owner.actionFailed"))),
            },
          );
        }}
      />

      <EditItemDialog
        item={editingItem}
        pending={updateItem.isPending}
        onClose={() => setEditingItem(null)}
        onSubmit={(input) => {
          if (!editingItem) return;
          updateItem.mutate(
            { itemId: editingItem.id, ...input },
            {
              onSuccess: () => {
                toast.success(t("owner.editItemSuccess"));
                setEditingItem(null);
              },
              onError: (err) => toast.error(getErrorMessage(err, t("owner.actionFailed"))),
            },
          );
        }}
      />

      <AddItemDialog
        open={addingItem}
        pending={addItem.isPending}
        onClose={() => setAddingItem(false)}
        onSubmit={(input) => {
          addItem.mutate(input, {
            onSuccess: () => {
              toast.success(t("owner.addItemSuccess"));
              setAddingItem(false);
            },
            onError: (err) => toast.error(getErrorMessage(err, t("owner.actionFailed"))),
          });
        }}
      />

      <ReasonDialog
        open={cancelling}
        title={t("owner.cancelSaleTitle")}
        description={sale ? t("sale.detailTitle", { number: sale.receiptNumber }) : undefined}
        confirmLabel={t("owner.cancelSale")}
        pending={cancelSale.isPending}
        onClose={() => setCancelling(false)}
        onConfirm={(reason) => {
          cancelSale.mutate(
            { reason },
            {
              onSuccess: () => {
                toast.success(t("owner.cancelSaleSuccess"));
                setCancelling(false);
              },
              onError: (err) => toast.error(getErrorMessage(err, t("owner.actionFailed"))),
            },
          );
        }}
      />
    </>
  );
}

function SaleHeader({ sale }: { sale: OwnerSaleDetail }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 text-sm text-white/50">
        <span>{format(new Date(sale.createdAt), "d MMMM yyyy, HH:mm", { locale: dateFnsLocale() })}</span>
        <span>·</span>
        <span>{sale.sellerName}</span>
        {sale.tableNumber !== null && (
          <span className="rounded-md bg-champ/15 px-1.5 py-0.5 text-xs font-bold text-champ">
            {t("table.numberShort", { number: sale.tableNumber })}
          </span>
        )}
        {sale.status === "CANCELLED" && (
          <span className="rounded-full bg-danger/15 px-2.5 py-1 text-xs font-bold text-danger-soft">
            {t("sale.statusCancelled")}
          </span>
        )}
      </div>
      {sale.status === "CANCELLED" && (
        <p className="mt-1 text-xs text-white/40">
          {t("owner.cancelledInfo", {
            name: sale.cancelledByName ?? "—",
            date: sale.cancelledAt ? format(new Date(sale.cancelledAt), "d MMM, HH:mm", { locale: dateFnsLocale() }) : "",
          })}
          {sale.cancelReason ? ` · ${sale.cancelReason}` : ""}
        </p>
      )}
    </div>
  );
}

function ItemRow({
  item,
  correctable,
  onRemove,
  onEdit,
}: {
  item: OwnerSaleItem;
  correctable: boolean;
  onRemove: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-ink-line bg-ink-soft p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-white">{item.productName}</p>
        <p className="text-xs text-white/40">
          {item.saleType === "WEIGHT"
            ? `${formatSaleQuantity(item.quantity, item.saleType)} × ${formatPrice(item.unitPrice)}`
            : `${item.quantity} × ${formatPrice(item.unitPrice)}`}
        </p>
      </div>
      <span className="shrink-0 font-semibold text-champ">{formatPrice(item.subtotal)}</span>
      {correctable && (
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-lg p-2 text-white/40 transition hover:bg-ink-line hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-2 text-white/40 transition hover:bg-ink-line hover:text-danger-soft"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

function RemovedItemRow({ item }: { item: OwnerSaleItem }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border border-ink-line/50 bg-transparent p-3 opacity-50">
      <p className="truncate text-sm text-white/50 line-through">
        {item.productName} · {item.quantity} × {formatPrice(item.unitPrice)}
      </p>
      <p className="text-xs text-white/30">
        {t("owner.removedBy", { name: item.removedByName ?? "—" })}
        {item.removeReason ? ` · ${item.removeReason}` : ""}
      </p>
    </div>
  );
}

function ChangeLogSection({ logs }: { logs: SaleChangeLogEntry[] }) {
  const { t } = useTranslation();
  if (logs.length === 0) return null;
  return (
    <div className="border-t border-ink-line pt-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-white/40">
        <History className="h-3.5 w-3.5" />
        {t("owner.changeLogTitle")}
      </h3>
      <ul className="space-y-2">
        {logs
          .slice()
          .reverse()
          .map((log) => (
            <li key={log.id} className="rounded-lg bg-ink-soft px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2 text-white/40">
                <span>{format(new Date(log.performedAt), "HH:mm, d MMM", { locale: dateFnsLocale() })}</span>
                <span>{log.performedByName}</span>
              </div>
              <p className="mt-0.5 text-white/80">{log.description}</p>
              {log.reason && <p className="mt-0.5 text-white/40">{t("owner.reasonLabel")}: {log.reason}</p>}
            </li>
          ))}
      </ul>
    </div>
  );
}

function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm: (reason: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) setReason("");
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {description && <p className="mb-3 text-sm text-white/70">{description}</p>}
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("owner.reasonPlaceholder")}
        rows={2}
        maxLength={300}
        className="input resize-none"
      />
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-ink-line px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={() => onConfirm(reason)}
          disabled={pending}
          className="rounded-xl bg-danger px-4 py-2 text-sm font-bold text-onaccent transition hover:bg-danger-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? t("common.pleaseWait") : confirmLabel}
        </button>
      </div>
    </Dialog>
  );
}

function EditItemDialog({
  item,
  pending,
  onClose,
  onSubmit,
}: {
  item: OwnerSaleItem | null;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: { quantity?: number; unitPrice?: number; reason?: string }) => void;
}) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (item) {
      setQuantity(item.quantity);
      setUnitPrice(item.unitPrice);
      setReason("");
    }
  }, [item]);

  function handleSubmit() {
    if (!item) return;
    const nextQuantity = Number(quantity);
    const nextPrice = Number(unitPrice);
    onSubmit({
      quantity: nextQuantity !== Number(item.quantity) ? nextQuantity : undefined,
      unitPrice: nextPrice !== Number(item.unitPrice) ? nextPrice : undefined,
      reason: reason.trim() || undefined,
    });
  }

  return (
    <Dialog open={item !== null} onClose={onClose} title={t("owner.editItemTitle")}>
      {item && (
        <>
          <p className="mb-4 text-sm text-white/70">{item.productName}</p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
                {t("sale.columns.quantity")}
              </span>
              <input
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                inputMode="decimal"
                className="input"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">
                {t("sale.columns.price")}
              </span>
              <input
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                inputMode="decimal"
                className="input"
              />
            </label>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("owner.reasonPlaceholder")}
            rows={2}
            maxLength={300}
            className="input mt-3 resize-none"
          />
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-ink-line px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending || !quantity || !unitPrice}
              className="rounded-xl bg-champ px-4 py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pending ? t("common.pleaseWait") : t("common.save")}
            </button>
          </div>
        </>
      )}
    </Dialog>
  );
}

function AddItemDialog({
  open,
  pending,
  onClose,
  onSubmit,
}: {
  open: boolean;
  pending: boolean;
  onClose: () => void;
  onSubmit: (input: { variantId: string; quantity: number; reason?: string }) => void;
}) {
  const { t } = useTranslation();
  // 100 is the server's hard cap on pageSize (product.schema.ts) — comfortably above any real
  // menu size for this business.
  const { data: products } = useProducts({ page: 1, pageSize: 100, isActive: true });
  const [variantId, setVariantId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setVariantId("");
      setQuantity("1");
      setReason("");
    }
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title={t("owner.addItem")}>
      <label className="mb-3 block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">{t("sale.columns.product")}</span>
        <select value={variantId} onChange={(e) => setVariantId(e.target.value)} className="input">
          <option value="">{t("owner.selectProduct")}</option>
          {products?.items.map((product) =>
            product.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>
                {product.name} — {variant.label} ({formatPrice(variant.price)})
              </option>
            )),
          )}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-white/40">{t("sale.columns.quantity")}</span>
        <input value={quantity} onChange={(e) => setQuantity(e.target.value)} inputMode="decimal" className="input" />
      </label>
      <textarea
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("owner.reasonPlaceholder")}
        rows={2}
        maxLength={300}
        className="input mt-3 resize-none"
      />
      <div className="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-ink-line px-4 py-2 text-sm font-medium text-white/70 transition hover:text-white"
        >
          {t("common.cancel")}
        </button>
        <button
          type="button"
          onClick={() => onSubmit({ variantId, quantity: Number(quantity), reason: reason.trim() || undefined })}
          disabled={pending || !variantId || !quantity || Number(quantity) <= 0}
          className="rounded-xl bg-champ px-4 py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? t("common.pleaseWait") : t("common.add")}
        </button>
      </div>
    </Dialog>
  );
}
