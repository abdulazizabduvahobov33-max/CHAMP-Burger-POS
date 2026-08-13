import { useState } from "react";
import { Check, Phone, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";

import { formatPrice } from "@/entities/product/lib";
import { useAcceptSale } from "@/entities/sale/api";
import { PaymentDialog } from "@/features/pos-payment/PaymentDialog";
import { getErrorMessage } from "@/shared/lib/errors";
import type { OrderNotification } from "@/shared/notifications/model";
import { useNotificationStore } from "@/shared/notifications/notificationStore";
import { usePrintReceipt } from "@/shared/printing/usePrintReceipt";
import { toast } from "@/shared/stores/toastStore";

/**
 * The persistent "new order" popups — pushed by useNotificationStream.ts on every `order.new`
 * event, mounted once at the app root so they show up over whichever admin page the cashier is
 * currently on. A card only leaves this stack once its order is actually accepted (from here or
 * from the pending-orders panel) — never on a timer; see notificationStore.ts's
 * resolveOrderNotification.
 *
 * Only ever mounted for a SUPER_ADMIN session (see AdminNotificationCenter.tsx) — the cashier
 * can accept from here, but cannot decline: if an order can't be fulfilled, they call the owner,
 * who declines it from their own dashboard (see owner.service.ts's rejectSale gating).
 */
export function OrderNotificationStack() {
  const { t } = useTranslation();
  const notifications = useNotificationStore((s) => s.orderNotifications);
  const acceptSale = useAcceptSale();
  const { printReceipt } = usePrintReceipt();
  const [payingFor, setPayingFor] = useState<OrderNotification | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

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
          <OrderNotificationCard key={n.id} notification={n} onAccept={() => setPayingFor(n)} />
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
    </>
  );
}

function OrderNotificationCard({ notification, onAccept }: { notification: OrderNotification; onAccept: () => void }) {
  const { t } = useTranslation();
  const { sellerName, tableNumber, receiptNumber, totalAmount, itemCount } = notification.data;

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
          <p className="text-xs font-bold uppercase tracking-wide text-white/50">{t("notifications.newOrderTitle")}</p>
          {/* Table number is the single most important thing on this card — it's how the
              cashier avoids mixing up which order is which — so it renders largest, before
              anything else, per the client's explicit "очень важно" requirement. */}
          {tableNumber !== null && (
            <p className="truncate text-xl font-extrabold text-champ">{t("table.numberShort", { number: tableNumber })}</p>
          )}
          <p className="truncate text-xs text-white/50">
            {sellerName ? t("notifications.waiterLabel", { name: sellerName }) : t("pos.pending.title")}
          </p>
        </div>
        <span className="shrink-0 text-base font-extrabold text-champ">{formatPrice(totalAmount)}</span>
      </div>
      <p className="mt-2 truncate text-xs text-white/40">
        №{receiptNumber} · {t("pos.itemsCount", { count: itemCount })}
      </p>
      <button
        type="button"
        onClick={onAccept}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-champ py-2 text-sm font-bold text-onaccent transition hover:bg-champ-hover active:scale-[0.98]"
      >
        <Check className="h-4 w-4" />
        {t("pos.acceptOrder")}
      </button>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/30">
        <Phone className="h-3 w-3 shrink-0" />
        {t("pos.pending.callOwnerHint")}
      </p>
    </div>
  );
}
