"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { reactivateOrganizationAction, suspendOrganizationAction } from "./actions";
import { initialOrgStatusState } from "./form-state";
import type { OrgStatus } from "./types";

/**
 * Suspendare/reactivare cu confirmare simpla inline (nu dialog modal — vezi
 * src/features/stock/lot-block-controls.tsx pentru acelasi pattern in codebase).
 * Parintele trebuie sa monteze componenta cu `key={organizationId + status}` ca
 * starea locala de confirmare sa se resetze automat dupa ce actiunea reuseste si
 * `status`-ul se schimba (revalidatePath aduce randul actualizat).
 */
export function OrgStatusControls({
  organizationId,
  status,
}: {
  organizationId: string;
  status: OrgStatus;
}) {
  const [confirming, setConfirming] = useState(false);
  const isActive = status === "active";
  const actionFn = isActive ? suspendOrganizationAction : reactivateOrganizationAction;
  const [state, action, pending] = useActionState(actionFn, initialOrgStatusState);

  if (!confirming) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(true)}>
        {isActive ? "Suspenda" : "Reactiveaza"}
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="organization_id" value={organizationId} />
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          {isActive ? "Sigur suspenzi organizatia?" : "Sigur reactivezi organizatia?"}
        </span>
        <Button type="button" size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Anuleaza
        </Button>
        <Button
          type="submit"
          size="sm"
          variant={isActive ? "destructive" : "default"}
          disabled={pending}
        >
          {pending ? "Se salveaza..." : "Confirma"}
        </Button>
      </div>
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}
