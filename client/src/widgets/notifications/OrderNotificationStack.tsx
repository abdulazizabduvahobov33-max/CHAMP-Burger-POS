import { useState } from "react";
import { Check, ShoppingBag, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatPrice } from "@/entities/product/lib";
import { useAcceptSale, useRejectSale } from "@/entities/sale/api";
import { PaymentDialog } from "@/features/pos-payment/PaymentDialog";
import { getErrorMessage } from "@/shared/lib/errors";
import type { OrderNotification } from "@/shared/notifications/model";
import { useNotificationStore } from "@/shared/notifications/notificationStore";
import { usePrintReceipt } from "@/shared/printing/usePrintReceipt";
import { toast } from "@/shared/stores/toastStore";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";

/**
 * The persistent "new order" popups — pushed by useNotificationStream.ts on every `order.new`
 * event, mounted once at the app root so they show up over whichever admin page the cashier is
 * currently on. A card only leaves this stack once its order is actually resolved (accepted or
 * rejected, from here or from the pending-orders panel) — never on a timer; see
 * notificationStore.ts's resolveOrderNotification.
 */
export function OrderNotificationStack() {
  const { t } = useTranslation();
  const notifications = useNotificationStore((s) => s.orderNotifications);
  const acceptSale = useAcceptSale();
  const rejectSale = useRejectSale();
  const { printReceipt } = usePrintReceipt();
  const [payingFor, setPayingFor] = useState<OrderNotification | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [rejectingFor, setRejectingFor] = useState<OrderNotification | null>(null);

  function handleAcceptConfirm(cashReceived: number) {
    if (!payingFor || acceptSale.isPending) return;
    setPayError(null);
    acceptSale.mutate(
      { id: payingFor.data.saleId, input: { cashReceived } },
      {
        onSuccess: (sale) => {
          setPayingFor(null);
          toast.success(t("pos.saleCompleted", { total: formatPrice(sale.totalAmount) }));
          void printReceipt(sale);
        },
        onError: (err) => setPayError(getErrorMessage(err, t("pos.saleFailed"))),
      },
    );
  }

  function handleRejectConfirm() {
    if (!rejectingFor || rejectSale.isPending) return;
    rejectSale.mutate(rejectingFor.data.saleId, {
      onSuccess: () => {
        setRejectingFor(null);
        toast.info(t("pos.pending.rejected"));
      },
      onError: (err) => toast.error(getErrorMessage(err, t("pos.saleFailed"))),
    });
  }

  if (notifications.length === 0) return null;

  return (
    <>
      {/* Anchored just above NotificationBell, growing upward as more arrive (flex-col-reverse
          on a bottom-anchored container: the newest card — last in the array — renders closest
          to the bell, and the stack's height grows away from it, not into it or the header).
          Right-anchored the same way at every width (no inset-x-0/sm: mixing — that combination
          previously lost to the plain, always-on `right` arbitrary property in the compiled
          stylesheet's cascade order and left the stack stuck flush-left on desktop). */}
      <div className="pointer-events-none fixed z-[71] flex w-[calc(100%-2rem)] max-w-sm flex-col-reverse items-end gap-2 [bottom:max(9.5rem,calc(env(safe-area-inset-bottom)+8.5rem))] [right:max(1rem,env(safe-area-inset-right))]">
        {notifications.map((n) => (
          <OrderNotificationCard key={n.id} notification={n} onAccept={() => setPayingFor(n)} onReject={() => setRejectingFor(n)} />
        ))}
      </div>

      <PaymentDialog
        open={payingFor !== null}
        onClose={() => setPayingFor(null)}
        total={payingFor ? Number(payingFor.data.totalAmount) : 0}
        isPending={acceptSale.isPending}
        error={payError}
        onConfirm={handleAcceptConfirm}
      />

      <ConfirmDialog
        open={rejectingFor !== null}
        title={t("pos.pending.rejectTitle")}
        description={t("pos.pending.rejectDescription", { number: rejectingFor?.data.receiptNumber ?? "" })}
        confirmLabel={t("pos.pending.rejectConfirm")}
        danger
        pending={rejectSale.isPending}
        onConfirm={handleRejectConfirm}
        onClose={() => setRejectingFor(null)}
      />
    </>
  );
}

function OrderNotificationCard({
  notification,
  onAccept,
  onReject,
}: {
  notification: OrderNotification;
  onAccept: () => void;
  onReject: () => void;
}) {
  const { t } = useTranslation();
  const { sellerName, receiptNumber, totalAmount, itemCount } = notification.data;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="pointer-events-auto w-full max-w-sm animate-scale-in rounded-xl border border-champ/50 bg-ink-card p-4 shadow-glow"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-champ/15 text-champ">
          <ShoppingBag className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">{t("notifications.newOrderTitle")}</p>
          <p className="truncate text-xs text-white/50">
            {sellerName ?? t("pos.pending.title")} · №{receiptNumber} · {t("pos.itemsCount", { count: itemCount })}
          </p>
        </div>
        <span className="shrink-0 text-base font-extrabold text-champ">{formatPrice(totalAmount)}</span>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onReject}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-ink-line px-3 py-2 text-sm font-medium text-white/60 transition hover:border-danger/50 hover:text-danger-soft"
        >
          <X className="h-4 w-4" />
          {t("pos.pending.reject")}
        </button>
        <button
          type="button"
          onClick={onAccept}
          className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-champ py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover active:scale-[0.98]"
        >
          <Check className="h-4 w-4" />
          {t("pos.acceptOrder")}
        </button>
      </div>
    </div>
  );
}
