"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { createLotAction, initialLotFormState } from "./actions";
import { PROVENANCE_LABELS, PROVENANCE_OPTIONS } from "./labels";
import type { ItemOption } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export function LotForm({ items }: { items: ItemOption[] }) {
  const [state, action, pending] = useActionState(createLotAction, initialLotFormState);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Detalii lot</CardTitle>
          <CardDescription>
            Înregistrează un nou lot cu proveniență — creează automat și evenimentul de intrare în
            audit-ul de stoc.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Item" required>
            {(id) => (
              <select id={id} name="item_id" required defaultValue="" className={selectClassName}>
                <option value="" disabled>
                  Alege un item...
                </option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({item.unit})
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Cantitate" required>
              {(id) => (
                <Input id={id} name="quantity" type="number" min="0" step="0.001" required />
              )}
            </FormField>
            <FormField label="Data intrare" hint="Implicit: astăzi.">
              {(id) => <Input id={id} name="entry_date" type="date" defaultValue={today} />}
            </FormField>
          </div>

          <FormField label="Proveniență" required>
            {(id) => (
              <select
                id={id}
                name="provenance"
                required
                defaultValue=""
                className={selectClassName}
              >
                <option value="" disabled>
                  Alege proveniența...
                </option>
                {PROVENANCE_OPTIONS.map((provenance) => (
                  <option key={provenance} value={provenance}>
                    {PROVENANCE_LABELS[provenance]}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Sursă" hint="Furnizor / proces / referință liberă.">
              {(id) => <Input id={id} name="source" />}
            </FormField>
            <FormField label="Locație" hint="Depozit / zonă (opțional).">
              {(id) => <Input id={id} name="location" />}
            </FormField>
          </div>

          <FormField label="Notă" hint="Atașată evenimentului de intrare, vizibilă în Audit stoc.">
            {(id) => <Input id={id} name="reason" />}
          </FormField>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Se înregistrează..." : "Înregistrează lotul"}
        </Button>
      </div>
    </form>
  );
}
