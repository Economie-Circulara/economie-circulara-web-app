"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { createItemAction, updateItemAction } from "./actions";
import { initialItemFormState } from "./action-state";
import { KIND_LABELS, KIND_OPTIONS, UNIT_LABELS, UNIT_OPTIONS } from "./labels";
import type { Item, ItemKind } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const textareaClassName =
  "flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** Formular creare/editare item - acelasi component, actiune diferita dupa mod. */
export function ItemForm({ item }: { item?: Item }) {
  const action = item ? updateItemAction : createItemAction;
  const [state, formAction, pending] = useActionState(action, initialItemFormState);
  // Tipul e in state (nu doar `defaultValue`) pentru ca de el depinde afisarea
  // comutatorului "Urmărește stocul" - relevant doar la itemii fizici (0029).
  const [kind, setKind] = useState<ItemKind>(item?.kind ?? "physical");

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      <Card>
        <CardHeader>
          <CardTitle>Detalii material/serviciu</CardTitle>
          <CardDescription>
            Titlu, unitate de măsură și tip - fizic (stoc + rețetă opțională) sau serviciu
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
              label="Tip"
              required
              hint="Fizic = stoc + rețetă opțională. Serviciu = abonament/serviciu PaaS, fără stoc."
            >
              {(id) => (
                <select
                  id={id}
                  name="kind"
                  required
                  value={kind}
                  onChange={(e) => setKind(e.target.value as ItemKind)}
                  className={selectClassName}
                >
                  {KIND_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {KIND_LABELS[option]}
                    </option>
                  ))}
                </select>
              )}
            </FormField>
          </div>

          <FormField label="Poză" hint="PNG, JPEG, WEBP sau GIF, max 2MB (opțional).">
            {(id) => (
              <div className="flex items-center gap-4">
                <div className="flex size-16 shrink-0 items-center justify-center rounded-md border border-dashed border-input bg-muted/40">
                  {item?.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="size-full rounded object-contain p-1"
                    />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">Fără poză</span>
                  )}
                </div>
                <div className="flex-1 space-y-2">
                  <Input
                    id={id}
                    name="image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="cursor-pointer"
                  />
                  {item?.imageUrl ? (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        name="remove_image"
                        className="size-4 rounded border-input"
                      />
                      Elimină poza curentă
                    </label>
                  ) : null}
                </div>
              </div>
            )}
          </FormField>

          {kind === "physical" ? (
            <div className="space-y-1">
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  name="is_tracked"
                  defaultChecked={item?.isTracked ?? true}
                  className="size-4 rounded border-input"
                />
                Urmărește stocul
              </label>
              <p className="text-xs text-muted-foreground">
                Dezactivează pentru materiale generice fără cantitate limitată (ex: apă, aer).
                Astfel de itemi pot fi componente de rețetă, dar nu se consumă din stoc.
              </p>
            </div>
          ) : null}

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
          {pending
            ? "Se salvează..."
            : item
              ? "Salvează modificările"
              : "Creează materialul sau serviciul"}
        </Button>
      </div>
    </form>
  );
}
