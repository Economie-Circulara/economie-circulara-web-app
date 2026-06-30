"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { inviteStaffAction, initialUserMgmtState } from "./user-actions";

export function InviteStaffForm() {
  const [state, action, pending] = useActionState(inviteStaffAction, initialUserMgmtState);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <FormField label="Email" className="min-w-56 flex-1">
        {(id) => (
          <Input id={id} name="email" type="email" placeholder="operator@firma.ro" required />
        )}
      </FormField>
      <FormField label="Nume" className="min-w-44 flex-1">
        {(id) => <Input id={id} name="full_name" placeholder="Nume complet" />}
      </FormField>
      <FormField label="Rol">
        {(id) => (
          <select
            id={id}
            name="role"
            defaultValue="operator"
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="operator">Operator</option>
            <option value="admin">Administrator</option>
          </select>
        )}
      </FormField>
      <Button type="submit" disabled={pending}>
        {pending ? "Se trimite..." : "Invita"}
      </Button>

      {state.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
      {state.message ? <p className="w-full text-sm text-primary">{state.message}</p> : null}
    </form>
  );
}
