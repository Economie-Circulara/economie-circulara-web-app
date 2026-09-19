"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { createRecipeAction } from "./actions";
import { initialRecipeFormState } from "./action-state";
import { DIRECTION_DESCRIPTIONS, DIRECTION_LABELS, DIRECTION_OPTIONS } from "./labels";
import type { RecipeDirection, RecipeItemOption } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Formular pornire rețetă noua: alege un item fizic fara rețetă inca SI directia
 * rețetei (migrarea 0028) - compunere (itemul e outputul, componentele se consuma)
 * sau descompunere (itemul e inputul, componentele rezulta din el). Directia se
 * alege explicit aici, nu se mai deduce din ecranul de productie folosit ulterior.
 */
export function RecipeNewForm({ items }: { items: RecipeItemOption[] }) {
  const [state, action, pending] = useActionState(createRecipeAction, initialRecipeFormState);
  const [direction, setDirection] = useState<RecipeDirection>("compunere");

  return (
    <form action={action} className="max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Alege materialul</CardTitle>
          <CardDescription>Doar materiale fizice, fără rețetă definită încă.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Material" required>
            {(id) => (
              <select id={id} name="item_id" required defaultValue="" className={selectClassName}>
                <option value="" disabled>
                  Alege un material...
                </option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title} ({item.unit})
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField label="Direcție" required hint={DIRECTION_DESCRIPTIONS[direction]}>
            {(id) => (
              <select
                id={id}
                name="direction"
                required
                value={direction}
                onChange={(e) => setDirection(e.target.value as RecipeDirection)}
                className={selectClassName}
              >
                {DIRECTION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {DIRECTION_LABELS[option]}
                  </option>
                ))}
              </select>
            )}
          </FormField>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending || items.length === 0}>
        {pending ? "Se creează..." : "Creează rețeta"}
      </Button>
    </form>
  );
}
