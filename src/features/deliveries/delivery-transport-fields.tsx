"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { initialDeliveryFormState, type DeliveryFormState } from "./action-state";

export interface DeliveryTransportFieldsProps {
  carrierName: string | null;
  vehiclePlate: string | null;
  driverName: string | null;
  /**
   * `updateDeliveryTransportAction.bind(null, deliveryId)`. Lipsa = doar citire
   * (livrare declarata in e-Transport sau cu receptia confirmata).
   */
  saveAction?: (prev: DeliveryFormState, formData: FormData) => Promise<DeliveryFormState>;
}

function Value({ label, value }: { label: string; value: string | null }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      {value ?? <span className="text-muted-foreground italic">necompletat</span>}
    </p>
  );
}

/**
 * Transportatorul, vehiculul si soferul unei livrari - optionale la planificare
 * (0058), completate sau corectate aici cat livrarea nu a plecat. e-Transport le cere.
 */
export function DeliveryTransportFields({
  carrierName,
  vehiclePlate,
  driverName,
  saveAction,
}: DeliveryTransportFieldsProps) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    saveAction ?? (async (prev: DeliveryFormState) => prev),
    initialDeliveryFormState,
  );
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) setEditing(false);
    wasPending.current = pending;
  }, [pending, state.error]);

  if (editing && saveAction) {
    return (
      <form action={action} className="space-y-3 rounded-md border p-3">
        <FormField label="Transportator">
          {(id) => <Input id={id} name="carrier_name" defaultValue={carrierName ?? ""} />}
        </FormField>
        <FormField label="Nr. înmatriculare">
          {(id) => <Input id={id} name="vehicle_plate" defaultValue={vehiclePlate ?? ""} />}
        </FormField>
        <FormField label="Șofer">
          {(id) => <Input id={id} name="driver_name" defaultValue={driverName ?? ""} />}
        </FormField>
        {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Se salvează..." : "Salvează"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
            Renunță
          </Button>
        </div>
      </form>
    );
  }

  const complete = Boolean(carrierName && vehiclePlate && driverName);
  return (
    <div className="space-y-1">
      <Value label="Transportator" value={carrierName} />
      <Value label="Vehicul" value={vehiclePlate} />
      <Value label="Șofer" value={driverName} />
      {saveAction ? (
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
          {complete ? "Modifică transportul" : "Completează transportul"}
        </Button>
      ) : null}
    </div>
  );
}
