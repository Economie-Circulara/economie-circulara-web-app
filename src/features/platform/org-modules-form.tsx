"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { MODULES, MODULE_KEYS, type ModuleKey } from "@/features/modules/modules";
import { updateOrganizationModulesAction } from "./actions";
import { initialOrgModulesState } from "./form-state";

export interface OrgModulesFormProps {
  organizationId: string;
  enabledModules: ModuleKey[];
}

/** Modulele optionale ale unei organizatii (doar super-admin, migrarea 0055). */
export function OrgModulesForm({ organizationId, enabledModules }: OrgModulesFormProps) {
  const [state, action, pending] = useActionState(
    updateOrganizationModulesAction,
    initialOrgModulesState,
  );

  return (
    <form action={action} className="max-w-3xl space-y-4">
      <input type="hidden" name="organization_id" value={organizationId} />
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Module</legend>
        <p className="text-sm text-muted-foreground">
          Functionalitati optionale, activate doar pentru organizatiile care le folosesc. Un modul
          dezactivat dispare din meniu; datele lui raman salvate si revin la reactivare.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {MODULE_KEYS.map((key) => (
            <label
              key={key}
              className="flex cursor-pointer gap-3 rounded-lg border bg-card p-3 has-[:checked]:border-primary has-[:checked]:ring-2 has-[:checked]:ring-ring"
            >
              <input
                type="checkbox"
                name="modules"
                value={key}
                defaultChecked={enabledModules.includes(key)}
                className="mt-1"
              />
              <span className="space-y-1">
                <span className="block text-sm font-semibold">{MODULES[key].label}</span>
                <span className="block text-xs text-muted-foreground">
                  {MODULES[key].description}
                </span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
      {state.message ? <p className="text-sm text-ok">{state.message}</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? "Se salveaza..." : "Salveaza modulele"}
      </Button>
    </form>
  );
}
