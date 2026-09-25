"use client";

import { useActionState, useState } from "react";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import { initialAddressFormState, type AddressFormState } from "./action-state";
import { deleteAddressAction, upsertAddressAction } from "./actions";
import { DEFAULT_ADDRESS_LABEL } from "./labels";
import type { ClientAddress } from "./types";

/** Actiune de formular pe adrese - staff (implicit) sau client (`/adresele-mele`, 0046). */
type AddressAction = (prev: AddressFormState, formData: FormData) => Promise<AddressFormState>;

interface AddressActions {
  upsertAction: AddressAction;
  deleteAction: AddressAction;
}

function AddressFormCard({
  clientId,
  address,
  onCancel,
  upsertAction,
}: {
  clientId: string;
  address?: ClientAddress;
  onCancel?: () => void;
  upsertAction: AddressAction;
}) {
  const [state, action, pending] = useActionState(upsertAction, initialAddressFormState);

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-card p-4">
      <input type="hidden" name="client_id" value={clientId} />
      {address ? <input type="hidden" name="id" value={address.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <FormField label="Etichetă" hint='Opțional - ex. "Depozit Otopeni".'>
          {(id) => <Input id={id} name="label" defaultValue={address?.label ?? ""} />}
        </FormField>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
          <input
            type="checkbox"
            name="is_default"
            defaultChecked={address?.isDefault ?? false}
            className="size-4 rounded border-input"
          />
          Adresă implicită
        </label>
      </div>

      <FormField label="Adresă" required>
        {(id) => <Input id={id} name="address" required defaultValue={address?.address ?? ""} />}
      </FormField>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Se salvează..." : address ? "Salvează adresa" : "Adaugă adresa"}
        </Button>
        {onCancel ? (
          <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
            Anulează
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function AddressRow({
  clientId,
  address,
  actions,
}: {
  clientId: string;
  address: ClientAddress;
  actions: AddressActions;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteState, deleteAction, deletePending] = useActionState(
    actions.deleteAction,
    initialAddressFormState,
  );

  if (editing) {
    return (
      <AddressFormCard
        clientId={clientId}
        address={address}
        onCancel={() => setEditing(false)}
        upsertAction={actions.upsertAction}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="flex items-center gap-2 text-sm font-medium">
          {address.label ?? "Adresă"}
          {address.isDefault ? <Badge variant="ok">{DEFAULT_ADDRESS_LABEL}</Badge> : null}
        </p>
        <p className="text-sm text-muted-foreground">{address.address}</p>
        {deleteState.error ? <p className="text-xs text-danger">{deleteState.error}</p> : null}
      </div>

      <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
        <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
          Editează
        </Button>
        {confirmingDelete ? (
          <form action={deleteAction} className="flex items-center gap-2">
            <input type="hidden" name="id" value={address.id} />
            <input type="hidden" name="client_id" value={clientId} />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setConfirmingDelete(false)}
            >
              Anulează
            </Button>
            <Button type="submit" size="sm" variant="destructive" disabled={deletePending}>
              {deletePending ? "Se șterge..." : "Confirmă"}
            </Button>
          </form>
        ) : (
          <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmingDelete(true)}>
            Șterge
          </Button>
        )}
      </div>
    </div>
  );
}

export interface AddressSectionProps {
  clientId: string;
  addresses: ClientAddress[];
  /** Actiunile clientului (`/adresele-mele`); implicit cele de staff. */
  upsertAction?: AddressAction;
  deleteAction?: AddressAction;
  /** Textul starii goale (difera intre staff si portalul clientului). */
  emptyDescription?: string;
}

/**
 * Sectiunea "Adrese de livrare" - CRUD + o singura adresa implicita. Folosita in
 * /clienti/[id] (staff) si in /adresele-mele (clientul, cu actiunile lui). Stergerea
 * unei adrese folosite deja pe o comanda o arhiveaza (0046), ca istoricul sa ramana.
 */
export function AddressSection({
  clientId,
  addresses,
  upsertAction = upsertAddressAction,
  deleteAction = deleteAddressAction,
  emptyDescription = "Adaugă prima adresă pentru livrările acestui client.",
}: AddressSectionProps) {
  const [addingNew, setAddingNew] = useState(false);
  const actions: AddressActions = { upsertAction, deleteAction };

  return (
    <div className="space-y-3">
      {addresses.length === 0 && !addingNew ? (
        <EmptyState
          icon={<MapPin />}
          title="Nicio adresă de livrare"
          description={emptyDescription}
        />
      ) : (
        <div className="space-y-2">
          {addresses.map((address) => (
            <AddressRow key={address.id} clientId={clientId} address={address} actions={actions} />
          ))}
        </div>
      )}

      {addingNew ? (
        <AddressFormCard
          clientId={clientId}
          onCancel={() => setAddingNew(false)}
          upsertAction={upsertAction}
        />
      ) : (
        <Button type="button" variant="outline" onClick={() => setAddingNew(true)}>
          + Adaugă adresă
        </Button>
      )}
    </div>
  );
}
