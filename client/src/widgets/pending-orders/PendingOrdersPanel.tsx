import { useState } from "react";
import { Check, Clock, Loader2, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatPrice } from "@/entities/product/lib";
import { useAcceptSale, usePendingSales } from "@/entities/sale/api";
import type { PendingSale } from "@/entities/sale/model";
import { PaymentDialog } from "@/features/pos-payment/PaymentDialog";
import { getErrorMessage } from "@/shared/lib/errors";
import { usePrintReceipt } from "@/shared/printing/usePrintReceipt";
import { toast } from "@/shared/stores/toastStore";
import { Dialog } from "@/shared/ui/Dialog";
import { EmptyState } from "@/shared/ui/EmptyState";

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * The "new orders" queue behind the admin's "Оформление заказа" register screen — every order a
 * waiter (SELLER) has sent with "Отправить заказ", awaiting the admin's "Принять заказ" before
 * stock is deducted and payment is captured. Accepting immediately fires the receipt to the
 * paired printer, same as the register's own direct checkout.
 */
export function PendingOrdersPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const { data: pending, isLoading } = usePendingSales();
  const acceptSale = useAcceptSale();
  const { printReceipt } = usePrintReceipt();
  const [accepting, setAccepting] = useState<PendingSale | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);

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
              <PendingOrderRow key={sale.id} sale={sale} onAccept={() => setAccepting(sale)} />
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
    </>
  );
}

function PendingOrderRow({ sale, onAccept }: { sale: PendingSale; onAccept: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="animate-fade-in rounded-xl border border-ink-line bg-ink-soft p-3.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{sale.sellerName}</p>
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
            {item.quantity} × {item.productName}
            {item.variantLabel ? ` (${item.variantLabel})` : ""}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onAccept}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-champ py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover active:scale-[0.98]"
      >
        <Check className="h-4 w-4" />
        {t("pos.acceptOrder")}
      </button>
    </div>
  );
}
