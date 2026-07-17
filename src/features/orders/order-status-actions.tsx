"use client";

import { useActionState } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { initialOrderTransitionState, type OrderTransitionState } from "./action-state";
import {
  acceptOrderAction,
  cancelOrderAction,
  closeOrderAction,
  deliverOrderAction,
  sendOrderAction,
} from "./actions";
import { canTransitionOrder } from "./state-machine";
import type { OrderStatus } from "./types";

type TransitionAction = (
  prev: OrderTransitionState,
  formData: FormData,
) => Promise<OrderTransitionState>;

function TransitionButton({
  orderId,
  action,
  label,
  pendingLabel,
  variant = "default",
}: {
  orderId: string;
  action: TransitionAction;
  label: string;
  pendingLabel: string;
  variant?: ButtonProps["variant"];
}) {
  const [state, formAction, pending] = useActionState(action, initialOrderTransitionState);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="order_id" value={orderId} />
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {state.error ? (
        <span className="max-w-48 text-right text-xs text-danger">{state.error}</span>
      ) : null}
    </form>
  );
}

/**
 * Butoane de tranzitie rapida (Trimite/Acceptă/Livrează/Închide/Anulează), pe baza
 * masinii de stari (`state-machine.ts`) — afiseaza doar tranzitiile valide din
 * statusul curent. Folosit atat in randul din tabel (`OrderTable`), cat si in
 * ecranul de detaliu.
 */
export function OrderStatusActions({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const canSend = canTransitionOrder(status, "sent");
  const canAccept = canTransitionOrder(status, "accepted");
  const canDeliver = canTransitionOrder(status, "delivered");
  const canClose = canTransitionOrder(status, "closed");
  const canCancel = canTransitionOrder(status, "cancelled");

  if (!canSend && !canAccept && !canDeliver && !canClose && !canCancel) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="flex flex-wrap items-start justify-end gap-2">
      {canSend ? (
        <TransitionButton
          orderId={orderId}
          action={sendOrderAction}
          label="Trimite"
          pendingLabel="Se trimite..."
          variant="outline"
        />
      ) : null}
      {canAccept ? (
        <TransitionButton
          orderId={orderId}
          action={acceptOrderAction}
          label="Acceptă"
          pendingLabel="Se acceptă..."
        />
      ) : null}
      {canDeliver ? (
        <TransitionButton
          orderId={orderId}
          action={deliverOrderAction}
          label="Livrează"
          pendingLabel="Se livrează..."
          variant="outline"
        />
      ) : null}
      {canClose ? (
        <TransitionButton
          orderId={orderId}
          action={closeOrderAction}
          label="Închide"
          pendingLabel="Se închide..."
          variant="outline"
        />
      ) : null}
      {canCancel ? (
        <TransitionButton
          orderId={orderId}
          action={cancelOrderAction}
          label="Anulează"
          pendingLabel="Se anulează..."
          variant="destructive"
        />
      ) : null}
    </div>
  );
}
