"use client";

import { useActionState, useState } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { initialDeliveryTransportState } from "./action-state";
import { updateDeliveryTransportAction } from "./actions";

export interface TransportFormProps {
  deliveryId: string;
  carrierName: string | null;
  vehiclePlate: string | null;
  driverName: string | null;
}

/**
 * „Editează transportul” pe /livrari/[id] (0057): transportatorul, vehiculul si
 * soferul pot lipsi la planificare si se completeaza aici, inainte de declararea
 * e-Transport. Pagina il afiseaza doar cat livrarea nu a plecat.
 */
export function TransportForm({
  deliveryId,
  carrierName,
  vehiclePlate,
  driverName,
}: TransportFormProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    updateDeliveryTransportAction,
    initialDeliveryTransportState,
  );

  if (!open) {
    return (
      <div className="space-y-2">
        {state.message ? <p className="text-sm text-ok">{state.message}</p> : null}
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          Editează transportul
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="delivery_id" value={deliveryId} />
      <FormField label="Transportator">
        {(id) => <Input id={id} name="carrier_name" defaultValue={carrierName ?? ""} />}
      </FormField>
      <FormField label="Nr. înmatriculare">
        {(id) => <Input id={id} name="vehicle_plate" defaultValue={vehiclePlate ?? ""} />}
      </FormField>
      <FormField label="Șofer">
        {(id) => <Input id={id} name="driver_name" defaultValue={driverName ?? ""} />}
      </FormField>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-ok">{state.message}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Se salvează..." : "Salvează"}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Închide
        </Button>
      </div>
    </form>
  );
}
