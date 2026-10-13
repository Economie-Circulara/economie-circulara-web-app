"use client";

import { useActionState } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createFuelEntryAction, updateFuelEntryAction } from "./actions";
import { initialFleetFormState } from "./action-state";
import { vehicleLabel } from "./labels";
import type { FuelEntry, Vehicle } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring";

const textareaClassName =
  "flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring";

interface FuelEntryFormProps {
  /** Vehiculele ACTIVE (pickerul nu arata arhivatele). */
  vehicles: Vehicle[];
  entry?: FuelEntry;
  defaultVehicleId?: string;
  today: string;
  /** Unde revine dupa creare (pagina vehiculului sau jurnalul). */
  returnTo?: string;
}

export function FuelEntryForm({
  vehicles,
  entry,
  defaultVehicleId,
  today,
  returnTo,
}: FuelEntryFormProps) {
  const [state, formAction, pending] = useActionState(
    entry ? updateFuelEntryAction : createFuelEntryAction,
    initialFleetFormState,
  );
  // Obligatoriu la alimentarile noi si la cele care il aveau deja (vezi actions.ts).
  const odometerRequired = !entry || entry.odometerKm !== null;
  // La editare, vehiculul alimentarii ramane in lista chiar daca intre timp a fost arhivat.
  const options =
    entry && !vehicles.some((v) => v.id === entry.vehicleId)
      ? [
          ...vehicles,
          { id: entry.vehicleId, name: entry.vehicleName, plate: entry.vehiclePlate } as Vehicle,
        ]
      : vehicles;

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {entry ? <input type="hidden" name="id" value={entry.id} /> : null}
      {returnTo ? <input type="hidden" name="return_to" value={returnTo} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>{entry ? "Corectează alimentarea" : "Alimentare nouă"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Vehicul" required>
              {(id) => (
                <select
                  id={id}
                  name="vehicle_id"
                  required
                  defaultValue={entry?.vehicleId ?? defaultVehicleId ?? ""}
                  className={selectClassName}
                >
                  <option value="" disabled>
                    Alege vehiculul
                  </option>
                  {options.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicleLabel(vehicle)}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Data" required>
              {(id) => (
                <Input
                  id={id}
                  name="filled_on"
                  type="date"
                  max={today}
                  defaultValue={entry?.filledOn ?? today}
                  required
                />
              )}
            </FormField>
            <FormField label="Litri" required>
              {(id) => (
                <Input
                  id={id}
                  name="liters"
                  inputMode="decimal"
                  defaultValue={entry ? String(entry.liters) : ""}
                  required
                />
              )}
            </FormField>
            <FormField label="Sumă plătită (lei)" hint="Opțional.">
              {(id) => (
                <Input
                  id={id}
                  name="amount"
                  inputMode="decimal"
                  defaultValue={entry?.amount !== null && entry ? String(entry.amount) : ""}
                />
              )}
            </FormField>
            <FormField
              label="Kilometraj la bord (km)"
              required={odometerRequired}
              hint="Din el se calculează km parcurși și consumul real."
            >
              {(id) => (
                <Input
                  id={id}
                  name="odometer_km"
                  inputMode="numeric"
                  required={odometerRequired}
                  defaultValue={entry?.odometerKm !== null && entry ? String(entry.odometerKm) : ""}
                />
              )}
            </FormField>
            <FormField label="Benzinărie" hint="Opțional.">
              {(id) => <Input id={id} name="station" defaultValue={entry?.station ?? ""} />}
            </FormField>
          </div>
          <FormField label="Bon (poză sau PDF, max 4MB)">
            {(id) => <Input id={id} name="receipt" type="file" accept="image/*,application/pdf" />}
          </FormField>
          {entry?.receipt ? (
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <a
                href={`/flota/alimentari/${entry.id}/bon`}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                Bonul actual: {entry.receipt.fileName}
              </a>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="remove_receipt" className="size-4" />
                Scoate bonul
              </label>
            </div>
          ) : null}
          <FormField label="Note">
            {(id) => (
              <textarea
                id={id}
                name="notes"
                rows={2}
                defaultValue={entry?.notes ?? ""}
                className={textareaClassName}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-ok">{state.message}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Se salvează..." : entry ? "Salvează corecția" : "Adaugă alimentarea"}
      </Button>
    </form>
  );
}
