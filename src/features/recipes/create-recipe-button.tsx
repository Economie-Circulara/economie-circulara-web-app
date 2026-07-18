"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { createRecipeAction, initialRecipeFormState } from "./actions";

/** Buton "Creează rețeta" pentru un item fizic care nu are inca una. */
export function CreateRecipeButton({ itemId }: { itemId: string }) {
  const [state, action, pending] = useActionState(createRecipeAction, initialRecipeFormState);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="item_id" value={itemId} />
      <p className="text-sm text-muted-foreground">Acest item nu are încă o rețetă definită.</p>
      <Button type="submit" disabled={pending}>
        {pending ? "Se creează..." : "Creează rețeta"}
      </Button>
      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
