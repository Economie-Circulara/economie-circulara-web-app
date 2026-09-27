"use client";

import { useActionState, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { initialUserMgmtState } from "@/features/settings/action-state";
import type { ClientPortalStatus } from "@/features/settings/queries";
import { inviteClientAction, resendClientInviteAction } from "@/features/settings/user-actions";

export interface ClientPortalInviteProps {
  clientId: string;
  defaultEmail: string | null;
  /** Starea contului din portal (vezi `getClientPortalStatus`). */
  portal: ClientPortalStatus;
  /** Doar admin poate invita (aceeasi regula ca /setari/utilizatori). */
  canInvite: boolean;
}

/**
 * Afordanta de invitare in portal de pe `/clienti/[id]`:
 * - cont activ -> indicator;
 * - invitatie trimisa, cont neactivat -> indicator + (admin) "Retrimite invitația"
 *   (`resendClientInviteAction`, catre emailul contului deja creat);
 * - fara cont -> (admin) "Invită în portal", acelasi mecanism ca /setari/utilizatori
 *   (`inviteClientAction` -> `sendClientInvite`), pre-completat cu emailul firmei.
 */
export function ClientPortalInvite({
  clientId,
  defaultEmail,
  portal,
  canInvite,
}: ClientPortalInviteProps) {
  if (portal.status === "active") {
    return <Badge variant="ok">Are cont în portal</Badge>;
  }
  if (portal.status === "pending") {
    return <PendingInvite clientId={clientId} email={portal.email} canInvite={canInvite} />;
  }
  return <NewInvite clientId={clientId} defaultEmail={defaultEmail} canInvite={canInvite} />;
}

function PendingInvite({
  clientId,
  email,
  canInvite,
}: {
  clientId: string;
  email: string | null;
  canInvite: boolean;
}) {
  const [state, action, pending] = useActionState(resendClientInviteAction, initialUserMgmtState);

  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-3">
      <input type="hidden" name="client_id" value={clientId} />
      <Badge variant="neutral" title={email ?? undefined}>
        Invitație trimisă{email ? ` - ${email}` : ""}
      </Badge>
      {canInvite ? (
        <Button type="submit" variant="outline" disabled={pending}>
          {pending ? "Se trimite..." : "Retrimite invitația"}
        </Button>
      ) : null}
      {state.message ? (
        <p className="w-full text-right text-sm text-primary">{state.message}</p>
      ) : null}
      {state.error ? <p className="w-full text-right text-sm text-danger">{state.error}</p> : null}
    </form>
  );
}

function NewInvite({
  clientId,
  defaultEmail,
  canInvite,
}: {
  clientId: string;
  defaultEmail: string | null;
  canInvite: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(inviteClientAction, initialUserMgmtState);

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
