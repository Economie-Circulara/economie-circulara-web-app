"use client";

import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { initialDeliveryFormState } from "./action-state";
import { confirmDeliveryReceiptAction } from "./actions";

export interface ReceiptFormProps {
  deliveryId: string;
  receivedAt: string | null;
  receivedByName: string | null;
  receiptNotes: string | null;
}

const dateTimeFormatter = new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "medium",
  timeStyle: "short",
});

/**
 * Confirmarea recepției livrării de către client (ecranul /livrari/[id],
 * caracteristica #4 din scrisoarea de clarificări AM nr. 1/31905/AM/07.09.2026) -
 * inregistrare MANUALA de catre staff (data curentă + numele persoanei care
 * confirmă, ex. dupa un aviz semnat la fata locului), NU o noua integrare.
 */
export function ReceiptForm({
  deliveryId,
  receivedAt,
  receivedByName,
  receiptNotes,
}: ReceiptFormProps) {
  const [state, formAction, pending] = useActionState(
    confirmDeliveryReceiptAction,
    initialDeliveryFormState,
  );

  if (receivedAt) {
    return (
      <div className="space-y-1 text-sm">
        <Badge variant="ok">Recepționată</Badge>
        <p>
          <span className="text-muted-foreground">Confirmat de: </span>
          {receivedByName ?? "-"}
        </p>
        <p>
          <span className="text-muted-foreground">Data: </span>
          {dateTimeFormatter.format(new Date(receivedAt))}
        </p>
        {receiptNotes ? <p className="text-muted-foreground">{receiptNotes}</p> : null}
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="delivery_id" value={deliveryId} />

      <FormField label="Confirmat de" required hint="Numele persoanei care a recepționat livrarea.">
        {(id) => <Input id={id} name="received_by_name" required placeholder="Nume și prenume" />}
      </FormField>
      <FormField label="Observații">
        {(id) => <Input id={id} name="receipt_notes" placeholder="Opțional" />}
      </FormField>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Se salvează..." : "Confirmă recepția"}
      </Button>
    </form>
  );
}
