"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Client, ClientAddress } from "@/features/clients/types";
import type { ItemOption } from "@/features/items/types";
import { initialOrderFormState } from "./action-state";
import { updateOrderAction } from "./actions";
import { OrderEditor, type OrderEditorValue } from "./order-editor";

interface OrderEditFormProps {
  orderId: string;
  clients: Client[];
  /** Adresele fiecarui client, precalculate - evita un fetch suplimentar la schimbarea clientului. */
  addressesByClient: Record<string, ClientAddress[]>;
  /** Itemi vandabili (catalog client) - liniile unei comenzi `material`/`serviciu`. */
  itemOptions: ItemOption[];
  /** Itemi fizici (si nevandabili) - liniile unei comenzi de tip `aport`. */
  intakeItemOptions: ItemOption[];
  /** Valorile initiale, precompletate din comanda draft existenta. */
  initialValue: OrderEditorValue;
}

/**
 * Formular editare comanda `draft` existenta (ecranul /comenzi/[id]/edit) -
 * acelasi tipar ca `OrderForm` (creare), dar catre `updateOrderAction`, cu
 * `OrderEditor` precompletat din comanda existenta. Pagina server-side
 * (`edit/page.tsx`) deja verifica `status === "draft"` inainte de a randa acest
 * formular, dar `updateOrder` (service.ts) re-verifica oricum, server-side.
 */
export function OrderEditForm({
  orderId,
  clients,
  addressesByClient,
  itemOptions,
  intakeItemOptions,
  initialValue,
}: OrderEditFormProps) {
  const [state, formAction, pending] = useActionState(updateOrderAction, initialOrderFormState);
  const [draft, setDraft] = useState<OrderEditorValue>(initialValue);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <input type="hidden" name="order_id" value={orderId} />
      <OrderEditor
        clients={clients}
        addressesByClient={addressesByClient}
        itemOptions={itemOptions}
        intakeItemOptions={intakeItemOptions}
        value={draft}
        onChange={setDraft}
        nativeFormFields
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || !draft.orderType || draft.lines.length === 0}>
          {pending ? "Se salvează..." : "Salvează modificările"}
        </Button>
      </div>
    </form>
  );
}
