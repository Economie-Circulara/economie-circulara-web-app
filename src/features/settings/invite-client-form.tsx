"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { inviteClientAction, initialUserMgmtState } from "./user-actions";
import type { AvailableClient } from "./queries";

export interface InviteClientFormProps {
  /** Firmele-client din organizatie care nu au inca un utilizator legat. */
  clients: AvailableClient[];
}

export function InviteClientForm({ clients }: InviteClientFormProps) {
  const [state, action, pending] = useActionState(inviteClientAction, initialUserMgmtState);

  if (clients.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Toate firmele-client au deja un utilizator asociat. Adauga o firma noua in{" "}
        <span className="font-medium">Clienti</span> pentru a o putea invita aici.
      </p>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <FormField label="Firma" className="min-w-56 flex-1">
        {(id) => (
          <select
            id={id}
            name="client_id"
            defaultValue=""
            required
            className="h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="" disabled>
              Selecteaza firma
            </option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.cui})
              </option>
            ))}
          </select>
        )}
      </FormField>
      <FormField label="Email" className="min-w-56 flex-1">
        {(id) => <Input id={id} name="email" type="email" placeholder="client@firma.ro" required />}
      </FormField>
      <Button type="submit" disabled={pending}>
        {pending ? "Se trimite..." : "Invita client"}
      </Button>

      {state.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
      {state.message ? <p className="w-full text-sm text-primary">{state.message}</p> : null}
    </form>
  );
}
