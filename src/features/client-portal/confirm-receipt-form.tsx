"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { initialClientReceiptFormState, type ClientReceiptFormState } from "./action-state";

export interface ConfirmReceiptFormProps {
  /** `confirmOwnDeliveryReceiptAction.bind(null, orderId)` - server action, serializabil. */
  action: (prev: ClientReceiptFormState, formData: FormData) => Promise<ClientReceiptFormState>;
}

/** Formularul "Confirmă recepția" din cardul "Transport" (portal client, 0045). */
export function ConfirmReceiptForm({ action }: ConfirmReceiptFormProps) {
  const [state, formAction, pending] = useActionState(action, initialClientReceiptFormState);

  if (state.done) {
    return <p className="text-sm font-medium">Recepția a fost confirmată. Mulțumim!</p>;
  }

  return (
    <form action={formAction} className="space-y-3 border-t pt-3">
      <p className="text-sm font-semibold">Ai primit marfa?</p>
      <FormField label="Primit de" required hint="Numele persoanei care a recepționat livrarea.">
        {(id) => <Input id={id} name="received_by_name" placeholder="Nume și prenume" />}
      </FormField>
      <FormField label="Observații" hint="Opțional.">
        {(id) => <Input id={id} name="notes" placeholder="Opțional" />}
      </FormField>
      {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Se confirmă..." : "Confirmă recepția"}
      </Button>
    </form>
  );
}
