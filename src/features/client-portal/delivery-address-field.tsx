"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import type { ClientAddress } from "@/features/clients/types";

/** Valoarea optiunii "+ Adresă nouă…" - aceeasi ca `NEW_ADDRESS_VALUE` din `actions.ts`. */
export const NEW_ADDRESS_OPTION = "__new__";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

export interface DeliveryAddressFieldProps {
  addresses: ClientAddress[];
  label?: string;
  hint?: string;
}

/**
 * Campul de adresa din formularele portalului (cos, aport - 0046): adresele din
 * agenda (implicita preselectata) + "+ Adresă nouă…", care deschide campurile
 * adresei noi si bifa "Salvează în adresele mele" (debifat = adresa ad hoc, doar
 * pentru aceasta comanda). Validarea si crearea adresei se fac pe server.
 */
export function DeliveryAddressField({
  addresses,
  label = "Adresă livrare",
  hint = "Opțional.",
}: DeliveryAddressFieldProps) {
  const defaultAddress = addresses.find((a) => a.isDefault);
  const [choice, setChoice] = useState(defaultAddress?.id ?? "");
  const isNew = choice === NEW_ADDRESS_OPTION;

  return (
    <div className="space-y-3">
      <FormField label={label} hint={hint}>
        {(id) => (
          <select
            id={id}
            name="delivery_address_id"
            value={choice}
            onChange={(e) => setChoice(e.target.value)}
            className={selectClassName}
          >
            <option value="">Fără adresă precizată</option>
            {addresses.map((address) => (
              <option key={address.id} value={address.id}>
                {address.label ? `${address.label} - ` : ""}
                {address.address}
                {address.isDefault ? " (implicită)" : ""}
              </option>
            ))}
            <option value={NEW_ADDRESS_OPTION}>+ Adresă nouă…</option>
          </select>
        )}
      </FormField>

      {isNew ? (
        <div className="space-y-3 rounded-md border bg-muted/30 p-3">
          <FormField label="Adresa nouă" required>
            {(id) => (
              <Input
                id={id}
                name="new_address"
                required
                placeholder="Localitate, stradă, număr"
                autoFocus
              />
            )}
          </FormField>
          <FormField label="Etichetă" hint='Opțional - ex. "Șantier Pipera".'>
            {(id) => <Input id={id} name="new_address_label" />}
          </FormField>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="save_address"
              defaultChecked
              className="size-4 rounded border-input"
            />
            Salvează în adresele mele
          </label>
          <p className="text-xs text-muted-foreground">
            Debifat: adresa se folosește doar pentru această comandă.
          </p>
        </div>
      ) : null}
    </div>
  );
}
