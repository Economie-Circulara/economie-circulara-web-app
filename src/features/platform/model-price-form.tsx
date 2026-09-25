"use client";

import { useActionState } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addModelPriceAction } from "./ai-pricing-actions";
import { initialModelPriceFormState } from "./form-state";

/**
 * Pret nou pentru un model = o VERSIUNE noua (preturile vechi raman, costurile deja
 * inregistrate nu se schimba). Numele modelului trebuie sa fie exact cel din raspunsul /
 * factura furnizorului (ex. `deepseek-v4-pro`); `*` = pretul implicit.
 */
export function ModelPriceForm() {
  const [state, action, pending] = useActionState(addModelPriceAction, initialModelPriceFormState);

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Model"
          required
          hint="Exact ca în factură, ex. deepseek-v4-pro. „*” = implicit."
        >
          {(id) => <Input id={id} name="model" required maxLength={100} />}
        </FormField>
        <FormField label="Valabil de la" hint="Gol = acum.">
          {(id) => <Input id={id} name="valid_from" type="datetime-local" />}
        </FormField>
        <FormField label="Input din cache (USD / 1M tokeni)" required>
          {(id) => <Input id={id} name="input_cache_hit_per_m" inputMode="decimal" required />}
        </FormField>
        <FormField label="Input nou (USD / 1M tokeni)" required>
          {(id) => <Input id={id} name="input_cache_miss_per_m" inputMode="decimal" required />}
        </FormField>
        <FormField label="Output (USD / 1M tokeni)" required>
          {(id) => <Input id={id} name="output_per_m" inputMode="decimal" required />}
        </FormField>
        <FormField label="Notă">
          {(id) => (
            <Input
              id={id}
              name="note"
              maxLength={500}
              placeholder="ex. listă de prețuri oct. 2026"
            />
          )}
        </FormField>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-ok">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Se salvează..." : "Adaugă prețul"}
      </Button>
    </form>
  );
}
