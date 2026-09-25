"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FormEvent } from "react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { initialOrderTransitionState, type OrderTransitionState } from "./action-state";
import {
  acceptOrderAction,
  cancelOrderAction,
  closeOrderAction,
  deliverOrderAction,
  sendOrderAction,
} from "./actions";
import { canTransitionOrderInFlow, type OrderFlow } from "./state-machine";
import type { OrderDeliveryGuard, OrderStatus } from "./types";

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
  confirmMessage,
}: {
  orderId: string;
  action: TransitionAction;
  label: string;
  pendingLabel: string;
  variant?: ButtonProps["variant"];
  /**
   * Cand e setat, submit-ul cere confirmare (`window.confirm`) inainte de a porni
   * tranzitia - codebase-ul nu are inca un primitiv de dialog (vezi
   * src/components/ui/), deci am ales confirmarea nativa a browserului in loc sa
   * adaug o dependinta noua doar pentru acest caz. Folosit de butonul manual
   * "Livrează" cand comanda nu are nicio livrare planificata (vezi
   * `OrderStatusActions` mai jos).
   */
  confirmMessage?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialOrderTransitionState);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      event.preventDefault();
    }
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="inline-flex flex-col items-end gap-1"
    >
      <input type="hidden" name="order_id" value={orderId} />
      <Button type="submit" size="sm" variant={variant} disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {state.error ? (
        <span className="max-w-48 text-right text-xs text-danger">{state.error}</span>
      ) : null}
      {state.insufficientStockItemId ? (
        <Link
          href={`/stoc/nou?item_id=${state.insufficientStockItemId}`}
          className="text-xs font-medium text-primary underline-offset-2 hover:underline"
        >
          Adaugă stoc pentru acest item
        </Link>
      ) : null}
    </form>
  );
}

/**
 * Butoane de tranzitie rapida (Înaintează/Confirmă/Livrează/Finalizează/Anulează),
 * pe baza masinii de stari (`state-machine.ts`) - afiseaza doar tranzitiile valide
 * din statusul curent. Folosit atat in randul din tabel (`OrderTable`), cat si in
 * ecranul de detaliu.
 *
 * `delivery` (guard-rail, vezi legatura livrare<->status din
 * `deliveries/service.ts#confirmDeliveryReceipt`): daca exista o livrare
 * planificata dar nepredata inca, butonul manual "Livrează" e ASCUNS complet -
 * confirmarea receptiei va trece automat comanda pe "delivered", un click manual
 * separat ar desincroniza livrarea (nepredata) de statusul comenzii (deja
 * livrata). Fara nicio livrare planificata (ridicare directa de la client, fara
 * curier formal), butonul ramane disponibil, dar cere confirmare explicita.
 */
export function OrderStatusActions({
  orderId,
  status,
  delivery = null,
  flow = "sale",
}: {
  orderId: string;
  status: OrderStatus;
  delivery?: OrderDeliveryGuard | null;
  /**
   * `intake` (aport / retur / garantie): doar "Anulează" (draft/sent) - acceptarea
   * are buton dedicat (`AcceptIntakeButton` / `AcceptReturnButton`).
   */
  flow?: OrderFlow;
}) {
  const can = (to: OrderStatus) => canTransitionOrderInFlow(status, to, flow);
  const canSend = can("sent");
  const canAccept = can("accepted");
  const canDeliverTransition = can("delivered");
  const canClose = can("closed");
  const canCancel = can("cancelled");

  const hasPendingDelivery = delivery != null && delivery.receivedAt == null;
  const showDeliverButton = canDeliverTransition && !hasPendingDelivery;

  if (!canSend && !canAccept && !showDeliverButton && !canClose && !canCancel) {
    return <span className="text-xs text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-wrap items-start justify-end gap-2">
      {canSend ? (
        <TransitionButton
          orderId={orderId}
          action={sendOrderAction}
          label="Înaintează spre aprobare"
          pendingLabel="Se înaintează..."
          variant="outline"
        />
      ) : null}
      {canAccept ? (
        <TransitionButton
          orderId={orderId}
          action={acceptOrderAction}
          label="Confirmă"
          pendingLabel="Se confirmă..."
        />
      ) : null}
      {showDeliverButton ? (
        <TransitionButton
          orderId={orderId}
          action={deliverOrderAction}
          label="Livrează"
          pendingLabel="Se livrează..."
          variant="outline"
          confirmMessage={
            delivery == null
              ? "Nu există livrare planificată pentru această comandă. Sigur marchezi manual ca livrată?"
              : undefined
          }
        />
      ) : null}
      {canClose ? (
        <TransitionButton
          orderId={orderId}
          action={closeOrderAction}
          label="Finalizează"
          pendingLabel="Se finalizează..."
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
