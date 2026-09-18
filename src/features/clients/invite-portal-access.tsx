"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { initialUserMgmtState } from "@/features/settings/action-state";
import { inviteClientAction } from "@/features/settings/user-actions";

export interface ClientPortalInviteProps {
  clientId: string;
  defaultEmail: string | null;
  /** Firma are deja un profil `client` legat (`profiles.client_id`). */
  hasPortalAccess: boolean;
  /** Doar admin poate invita (aceeasi regula ca /setari/utilizatori). */
  canInvite: boolean;
}

/**
 * Afordanta de invitare in portal de pe `/clienti/[id]`: daca firma are deja un
 * utilizator legat arata un indicator, altfel (doar pentru admin) ofera un buton
 * "Invită în portal" care deschide acelasi formular/mecanism folosit in
 * /setari/utilizatori (`inviteClientAction` -> `sendClientInvite`), pre-completat
 * cu emailul firmei.
 */
export function ClientPortalInvite({
  clientId,
  defaultEmail,
  hasPortalAccess,
  canInvite,
}: ClientPortalInviteProps) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(inviteClientAction, initialUserMgmtState);

  if (hasPortalAccess) {
    return <Badge variant="ok">Are cont în portal</Badge>;
  }

  if (state.message) {
    return <p className="text-sm text-primary">{state.message}</p>;
  }

  if (!canInvite) {
    return <Badge variant="neutral">Fără cont în portal</Badge>;
  }

  if (!open) {
    return (
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Invită în portal
      </Button>
    );
  }

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      <FormField label="Email" className="min-w-56 flex-1">
        {(id) => (
          <Input
            id={id}
            name="email"
            type="email"
            required
            defaultValue={defaultEmail ?? ""}
            placeholder="client@firma.ro"
          />
        )}
      </FormField>
      <Button type="submit" disabled={pending}>
        {pending ? "Se trimite..." : "Trimite invitație"}
      </Button>
      <Button type="button" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
        Anulează
      </Button>
      {state.error ? <p className="w-full text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}
