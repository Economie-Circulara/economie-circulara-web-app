"use client";

import { useActionState } from "react";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateCreditSettingsAction, updateOrganizationAiLimitsAction } from "./ai-pricing-actions";
import type { OrganizationAiLimits } from "./ai-usage-queries";
import { initialAiLimitsFormState } from "./form-state";

/** Valoarea unui credit AI si plafonul per mesaj (setari globale ale platformei). */
export function CreditSettingsForm({
  creditMicros,
  turnCreditLimit,
}: {
  creditMicros: number;
  turnCreditLimit: number;
}) {
  const [state, action, pending] = useActionState(
    updateCreditSettingsAction,
    initialAiLimitsFormState,
  );
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Valoarea unui credit (USD)"
          required
          hint="Ex. 0,001 - un răspuns de $0,0026 consumă 3 credite. Schimbarea recalculează și consumul deja afișat."
        >
          {(id) => (
            <Input
              id={id}
              name="credit_usd"
              inputMode="decimal"
              defaultValue={String(creditMicros / 1_000_000)}
              required
            />
          )}
        </FormField>
        <FormField
          label="Plafon per mesaj (credite)"
          required
          hint="Peste plafon, asistentul se oprește și răspunde cu ce a aflat. 0 = fără plafon."
        >
          {(id) => (
            <Input
              id={id}
              name="turn_credit_limit"
              inputMode="numeric"
              defaultValue={String(turnCreditLimit)}
              required
            />
          )}
        </FormField>
      </div>
      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-ok">{state.message}</p> : null}
      <Button type="submit" disabled={pending}>
        {pending ? "Se salvează..." : "Salvează"}
      </Button>
    </form>
  );
}

/** Un rand editabil: limitele AI ale unei organizatii. */
export function OrganizationAiLimitsForm({ organization }: { organization: OrganizationAiLimits }) {
  const [state, action, pending] = useActionState(
    updateOrganizationAiLimitsAction,
    initialAiLimitsFormState,
  );
  const prefix = `org-${organization.id}`;
  return (
    <form action={action} className="flex flex-wrap items-end gap-3 border-b py-3 last:border-b-0">
      <input type="hidden" name="organization_id" value={organization.id} />
      <p className="min-w-40 flex-1 text-sm font-medium">{organization.name}</p>
      <label className="flex items-center gap-2 text-sm" htmlFor={`${prefix}-enabled`}>
        <input
          id={`${prefix}-enabled`}
          type="checkbox"
          name="enabled"
          defaultChecked={organization.enabled}
          className="size-4 rounded border-input"
        />
        Activ
      </label>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground" htmlFor={`${prefix}-monthly`}>
          Credite / lună
        </label>
        <Input
          id={`${prefix}-monthly`}
          name="monthly_credits"
          inputMode="numeric"
          className="w-28"
          defaultValue={String(organization.monthlyCredits)}
        />
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground" htmlFor={`${prefix}-daily`}>
          % pe zi / utilizator
        </label>
        <Input
          id={`${prefix}-daily`}
          name="daily_percent"
          inputMode="numeric"
          className="w-20"
          defaultValue={String(organization.dailyPercent)}
        />
      </div>
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "..." : "Salvează"}
      </Button>
      {state.error ? <p className="w-full text-xs text-destructive">{state.error}</p> : null}
      {state.message ? <p className="w-full text-xs text-ok">{state.message}</p> : null}
    </form>
  );
}
