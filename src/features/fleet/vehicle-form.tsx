"use client";

import { useActionState } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createVehicleAction, updateVehicleAction } from "./actions";
import { initialFleetFormState } from "./action-state";
import {
  CAPACITY_UNIT_LABELS,
  CAPACITY_UNIT_OPTIONS,
  FUEL_TYPE_SUGGESTIONS,
  VEHICLE_TYPE_SUGGESTIONS,
} from "./labels";
import type { Vehicle } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring";

const textareaClassName =
  "flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring";

/** Creare / editare vehicul. Obligatorii: numele si consumul; restul optional. */
export function VehicleForm({ vehicle }: { vehicle?: Vehicle }) {
  const [state, formAction, pending] = useActionState(
    vehicle ? updateVehicleAction : createVehicleAction,
    initialFleetFormState,
  );

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {vehicle ? <input type="hidden" name="id" value={vehicle.id} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Date vehicul</CardTitle>
          <CardDescription>
            Consumul mediu e baza estimării de combustibil pe transporturi.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Nume / cod intern" required hint="Ex. „Basculanta 1”.">
              {(id) => <Input id={id} name="name" defaultValue={vehicle?.name ?? ""} required />}
            </FormField>
            <FormField label="Nr. de înmatriculare">
              {(id) => (
                <Input
                  id={id}
                  name="plate"
                  defaultValue={vehicle?.plate ?? ""}
                  placeholder="IS-12-ABC"
                />
              )}
            </FormField>
            <FormField label="Consum mediu (L / 100 km)" required>
              {(id) => (
                <Input
                  id={id}
                  name="consumption"
                  inputMode="decimal"
                  defaultValue={vehicle ? String(vehicle.consumptionLPer100km) : ""}
                  placeholder="ex. 32,5"
                  required
                />
              )}
            </FormField>
            <FormField label="Combustibil">
              {(id) => (
                <>
                  <Input
                    id={id}
                    name="fuel_type"
                    list="fleet-fuel-types"
                    defaultValue={vehicle?.fuelType ?? ""}
                  />
                  <datalist id="fleet-fuel-types">
                    {FUEL_TYPE_SUGGESTIONS.map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </>
              )}
            </FormField>
            <FormField label="Tip vehicul">
              {(id) => (
                <>
                  <Input
                    id={id}
                    name="vehicle_type"
                    list="fleet-vehicle-types"
                    defaultValue={vehicle?.vehicleType ?? ""}
                  />
                  <datalist id="fleet-vehicle-types">
                    {VEHICLE_TYPE_SUGGESTIONS.map((value) => (
                      <option key={value} value={value} />
                    ))}
                  </datalist>
                </>
              )}
            </FormField>
            <FormField label="Șofer obișnuit">
              {(id) => (
                <Input
                  id={id}
                  name="default_driver_name"
                  defaultValue={vehicle?.defaultDriverName ?? ""}
                />
              )}
            </FormField>
            <FormField label="Capacitate" hint="Cât poate căra - informativ.">
              {(id) => (
                <Input
                  id={id}
                  name="capacity"
                  inputMode="decimal"
                  defaultValue={
                    vehicle?.capacity !== null && vehicle ? String(vehicle.capacity) : ""
                  }
                />
              )}
            </FormField>
            <FormField label="Unitate capacitate">
              {(id) => (
                <select
                  id={id}
                  name="capacity_unit"
                  defaultValue={vehicle?.capacityUnit ?? ""}
                  className={selectClassName}
                >
                  <option value="">—</option>
                  {CAPACITY_UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {CAPACITY_UNIT_LABELS[unit]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>
          <FormField label="Note">
            {(id) => (
              <textarea
                id={id}
                name="notes"
                rows={3}
                defaultValue={vehicle?.notes ?? ""}
                className={textareaClassName}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-ok">{state.message}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Se salvează..." : vehicle ? "Salvează" : "Adaugă vehiculul"}
      </Button>
    </form>
  );
}
