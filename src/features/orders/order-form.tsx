"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import type { Client, ClientAddress } from "@/features/clients/types";
import type { ItemOption } from "@/features/items/types";
import { initialOrderFormState } from "./action-state";
import { createOrderAction } from "./actions";
import { emptyOrderEditorValue, OrderEditor, type OrderEditorValue } from "./order-editor";

interface OrderFormProps {
  clients: Client[];
  /** Adresele fiecarui client, precalculate - evita un fetch suplimentar la schimbarea clientului. */
  addressesByClient: Record<string, ClientAddress[]>;
  /** Itemi vandabili (catalog client) - singurele linii permise intr-o comanda. */
  itemOptions: ItemOption[];
}

/**
 * Formular creare comanda in numele unui client (`created_by_admin=true`, ecranul
 * /comenzi/nou) - wrapper subtire peste `OrderEditor` (editorul PARTAJAT cu cardul
 * de confirmare "creeaza_comanda" al asistentului, vezi
 * docs/plans/asistent-contract-capabilitati.md): pastreaza doar submit-ul nativ
 * (`useActionState`/`createOrderAction`), starea/randarea campurilor traiesc in
 * `OrderEditor` (`nativeFormFields` = controalele primesc `name=...`, ca liniile
 * sa ajunga la server ca perechi repetate `item_id`/`quantity` - vezi `readLines`
 * din `actions.ts`).
 */
export function OrderForm({ clients, addressesByClient, itemOptions }: OrderFormProps) {
  const [state, formAction, pending] = useActionState(createOrderAction, initialOrderFormState);
  const [draft, setDraft] = useState<OrderEditorValue>(emptyOrderEditorValue);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <OrderEditor
        clients={clients}
        addressesByClient={addressesByClient}
        itemOptions={itemOptions}
        value={draft}
        onChange={setDraft}
        nativeFormFields
      />

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || draft.lines.length === 0}>
          {pending ? "Se creează..." : "Creează comanda"}
        </Button>
      </div>
    </form>
  );
}
