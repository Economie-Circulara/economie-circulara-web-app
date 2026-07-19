"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { initialDeliveryFormState } from "./action-state";
import { planDeliveryAction } from "./actions";

export interface DeliveryFormProps {
  orderId: string;
  orderNumber: string | null;
  clientName: string;
}

/**
 * Formular de planificare livrare (ecranul /livrari/nou) — creeaza un singur rand
 * `deliveries` pt. o comanda ACCEPTATA (`planDeliveryAction`, care redirectioneaza
 * la ecranul de detaliu al livrarii nou-create). Camp cerute de Task X5: data
 * programata, transportator, nr. inmatriculare, sofer, ruta (plecare/sosire).
 */
export function DeliveryForm({ orderId, orderNumber, clientName }: DeliveryFormProps) {
  const [state, formAction, pending] = useActionState(planDeliveryAction, initialDeliveryFormState);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      <input type="hidden" name="order_id" value={orderId} />

      <Card>
        <CardHeader>
          <CardTitle>Comandă</CardTitle>
          <CardDescription>
            {orderNumber ?? "Draft"} · {clientName}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Detalii transport</CardTitle>
          <CardDescription>
            Vehicul, șofer și rută — necesare pt. avizul de însoțire.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <FormField label="Data programată" required>
            {(id) => <Input id={id} name="scheduled_date" type="date" required />}
          </FormField>
          <FormField label="Transportator" required>
            {(id) => <Input id={id} name="carrier_name" placeholder="Ex. Transport SRL" required />}
          </FormField>
          <FormField
            label="Nr. înmatriculare"
            required
            hint="Identifică vehiculul (pregătit pt. monitorizare GPS, v2)."
          >
            {(id) => <Input id={id} name="vehicle_plate" placeholder="Ex. B 123 ABC" required />}
          </FormField>
          <FormField label="Șofer" required>
            {(id) => <Input id={id} name="driver_name" placeholder="Nume și prenume" required />}
          </FormField>
          <FormField label="Punct de plecare" required>
            {(id) => (
              <Input id={id} name="route_origin" placeholder="Ex. Depozit central" required />
            )}
          </FormField>
          <FormField label="Punct de sosire" required>
            {(id) => (
              <Input id={id} name="route_destination" placeholder="Adresa de livrare" required />
            )}
          </FormField>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Se planifică..." : "Planifică livrarea"}
        </Button>
      </div>
    </form>
  );
}
