"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { createItemAction, initialItemFormState, updateItemAction } from "./actions";
import { KIND_LABELS, KIND_OPTIONS, UNIT_LABELS, UNIT_OPTIONS } from "./labels";
import type { Item } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const textareaClassName =
  "flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** Formular creare/editare item — acelasi component, actiune diferita dupa mod. */
export function ItemForm({ item }: { item?: Item }) {
  const action = item ? updateItemAction : createItemAction;
  const [state, formAction, pending] = useActionState(action, initialItemFormState);

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Detalii item</CardTitle>
          <CardDescription>
            Titlu, unitate de măsură și tip — fizic (stoc + rețetă opțională) sau serviciu
            (abonament/serviciu PaaS, fără stoc).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Titlu" required>
            {(id) => <Input id={id} name="title" defaultValue={item?.title ?? ""} required />}
          </FormField>

          <FormField label="Descriere">
            {(id) => (
              <textarea
                id={id}
                name="description"
                defaultValue={item?.description ?? ""}
                className={textareaClassName}
                rows={3}
              />
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Unitate de măsură" required>
              {(id) => (
                <select
                  id={id}
                  name="unit"
                  required
                  defaultValue={item?.unit ?? ""}
                  className={selectClassName}
                >
                  <option value="" disabled>
                    Alege UM...
                  </option>
                  {UNIT_OPTIONS.map((unit) => (
                    <option key={unit} value={unit}>
                      {UNIT_LABELS[unit]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField
              label="Tip item"
              required
              hint="Fizic = stoc + rețetă opțională. Serviciu = abonament/serviciu PaaS, fără stoc."
            >
              {(id) => (
                <select
                  id={id}
                  name="kind"
                  required
                  defaultValue={item?.kind ?? "physical"}
                  className={selectClassName}
                >
                  {KIND_OPTIONS.map((kind) => (
                    <option key={kind} value={kind}>
                      {KIND_LABELS[kind]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>

          <FormField label="URL poză" hint="Adresa publică a imaginii (opțional).">
            {(id) => (
              <Input
                id={id}
                name="image_url"
                defaultValue={item?.imageUrl ?? ""}
                placeholder="https://..."
              />
            )}
          </FormField>

          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              name="sellable"
              defaultChecked={item?.sellable ?? false}
              className="size-4 rounded border-input"
            />
            Vandabil (apare în catalogul clientului)
          </label>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salvează..." : item ? "Salvează modificările" : "Creează itemul"}
        </Button>
      </div>
    </form>
  );
}
