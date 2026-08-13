import { useState } from "react";
import { Check, Clock, Loader2, Phone, ShoppingBag, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatPrice, formatSaleQuantity } from "@/entities/product/lib";
import { useAcceptSale, usePendingSales, useRejectSale } from "@/entities/sale/api";
import type { PendingSale } from "@/entities/sale/model";
import { PaymentDialog } from "@/features/pos-payment/PaymentDialog";
import { getErrorMessage } from "@/shared/lib/errors";
import { usePrintReceipt } from "@/shared/printing/usePrintReceipt";
import { toast } from "@/shared/stores/toastStore";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Dialog } from "@/shared/ui/Dialog";
import { EmptyState } from "@/shared/ui/EmptyState";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * The "new orders" queue behind the admin's "Оформление заказа" register screen — every order a
 * waiter (SELLER) has sent with "Отправить заказ", awaiting a decision before stock is deducted
 * and payment is captured. Accepting immediately fires the receipt to the paired printer, same
 * as the register's own direct checkout.
 *
 * `canReject` is false for the cashier (SUPER_ADMIN) instance of this panel — a cashier can only
 * accept now; if an order genuinely can't be fulfilled, they call the owner instead of deciding
 * on their own (see the in-row hint below). The OWNER's own dashboard reuses this same component
 * with `canReject` true, since only the owner may actually decline one.
 */
export function PendingOrdersPanel({
  open,
  onClose,
  canReject = false,
}: {
  open: boolean;
  onClose: () => void;
  canReject?: boolean;
}) {
  const { t } = useTranslation();
  const { data: pending, isLoading } = usePendingSales();
  const acceptSale = useAcceptSale();
  const rejectSale = useRejectSale();
  const { printReceipt } = usePrintReceipt();
  const [accepting, setAccepting] = useState<PendingSale | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<PendingSale | null>(null);

  function handleAcceptConfirm(cashReceived: number) {
    if (!accepting || acceptSale.isPending) return;
    setAcceptError(null);
    acceptSale.mutate(
      { id: accepting.id, input: { cashReceived } },
      {
        onSuccess: (sale) => {
          setAccepting(null);
          toast.success(t("pos.saleCompleted", { total: formatPrice(sale.totalAmount) }));
          void printReceipt(sale);
        },
        onError: (err) => setAcceptError(getErrorMessage(err, t("pos.saleFailed"))),
      },
    );
  }

  function handleRejectConfirm() {
    if (!rejecting || rejectSale.isPending) return;
    rejectSale.mutate(rejecting.id, {
      onSuccess: () => {
        setRejecting(null);
        toast.info(t("pos.pending.rejected"));
      },
      onError: (err) => toast.error(getErrorMessage(err, t("pos.saleFailed"))),
    });
  }

  return (
    <>
      <Dialog open={open} onClose={onClose} title={t("pos.pending.title")} widthClassName="max-w-lg">
        {isLoading && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        )}

        {!isLoading && (!pending || pending.length === 0) && (
          <EmptyState icon={ShoppingBag} title={t("pos.pending.emptyTitle")} description={t("pos.pending.emptyDescription")} />
        )}

        {!isLoading && pending && pending.length > 0 && (
          <div className="max-h-[65vh] space-y-2 overflow-y-auto">
            {pending.map((sale) => (
              <PendingOrderRow
                key={sale.id}
                sale={sale}
                canReject={canReject}
                onAccept={() => setAccepting(sale)}
                onReject={() => setRejecting(sale)}
              />
            ))}
          </div>
        )}
      </Dialog>

      <PaymentDialog
        open={accepting !== null}
        onClose={() => setAccepting(null)}
        total={accepting ? Number(accepting.totalAmount) : 0}
        isPending={acceptSale.isPending}
        error={acceptError}
        onConfirm={handleAcceptConfirm}
      />

      {canReject && (
        <ConfirmDialog
          open={rejecting !== null}
          title={t("pos.pending.rejectTitle")}
          description={t("pos.pending.rejectDescription", { number: rejecting?.receiptNumber ?? "" })}
          confirmLabel={t("pos.pending.rejectConfirm")}
          danger
          pending={rejectSale.isPending}
          onConfirm={handleRejectConfirm}
          onClose={() => setRejecting(null)}
        />
      )}
    </>
  );
}

function PendingOrderRow({
  sale,
  canReject,
  onAccept,
  onReject,
}: {
  sale: PendingSale;
  canReject: boolean;
  onAccept: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="animate-fade-in rounded-xl border border-ink-line bg-ink-soft p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {sale.tableNumber !== null && (
              <span className="shrink-0 rounded-lg bg-champ/15 px-2 py-0.5 text-sm font-extrabold text-champ">
                {t("table.numberShort", { number: sale.tableNumber })}
              </span>
            )}
            <p className="truncate text-sm font-semibold text-white">{sale.sellerName}</p>
          </div>
          <p className="flex items-center gap-1 text-xs text-white/40">
            <Clock className="h-3 w-3" />
            {formatTime(sale.createdAt)} · №{sale.receiptNumber}
          </p>
        </div>
        <span className="shrink-0 text-lg font-extrabold text-champ">{formatPrice(sale.totalAmount)}</span>
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-white/50">
        {sale.items.map((item) => (
          <li key={item.id} className="truncate">
            {formatSaleQuantity(item.quantity, item.saleType)} × {item.productName}
            {item.saleType !== "WEIGHT" && item.variantLabel ? ` (${item.variantLabel})` : ""}
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        {canReject && (
          <button
            type="button"
            onClick={onReject}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-line px-3 py-2 text-sm font-medium text-white/60 transition hover:border-danger/50 hover:text-danger-soft"
          >
            <X className="h-4 w-4" />
            {t("pos.pending.reject")}
          </button>
        )}
        <button
          type="button"
          onClick={onAccept}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-champ py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover active:scale-[0.98]"
        >
          <Check className="h-4 w-4" />
          {t("pos.acceptOrder")}
        </button>
      </div>
      {!canReject && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/30">
          <Phone className="h-3 w-3 shrink-0" />
          {t("pos.pending.callOwnerHint")}
        </p>
      )}
    </div>
  );
}
