"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormField } from "@/components/form-field";
import { createRecipeAction, initialRecipeFormState } from "./actions";
import type { RecipeItemOption } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** Formular pornire rețetă noua: alege un item fizic fara rețetă inca. */
export function RecipeNewForm({ items }: { items: RecipeItemOption[] }) {
  const [state, action, pending] = useActionState(createRecipeAction, initialRecipeFormState);

  return (
    <form action={action} className="max-w-xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Alege itemul</CardTitle>
          <CardDescription>Doar itemi fizici, fără rețetă definită încă.</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <Button type="submit" disabled={pending || items.length === 0}>
        {pending ? "Se creează..." : "Creează rețeta"}
      </Button>
    </form>
  );
}
