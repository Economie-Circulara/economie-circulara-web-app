"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import type { Client, ClientAddress } from "@/features/clients/types";
import type { ItemOption } from "@/features/items/types";

export const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const textareaClassName =
  "flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** O linie a draftului - `key` doar pentru randare (nu se refoloseste `itemId` ca cheie). */
export interface OrderEditorLine {
  key: string;
  itemId: string;
  quantity: number;
}

/** Starea completa a draftului editat - controlata de parinte (`OrderForm` sau cardul asistentului). */
export interface OrderEditorValue {
  clientId: string;
  deliveryAddressId: string;
  deliveryDate: string;
  notes: string;
  lines: OrderEditorLine[];
}

export function emptyOrderEditorValue(): OrderEditorValue {
  return { clientId: "", deliveryAddressId: "", deliveryDate: "", notes: "", lines: [] };
}

export interface OrderEditorProps {
  clients: Client[];
  /** Adresele fiecarui client, precalculate - evita un fetch suplimentar la schimbarea clientului. */
  addressesByClient: Record<string, ClientAddress[]>;
  /** Itemi vandabili (catalog client) - singurele linii permise intr-o comanda. */
  itemOptions: ItemOption[];
  value: OrderEditorValue;
  onChange: (value: OrderEditorValue) => void;
  /**
   * `true` -> controalele native primesc `name=...`, ca sa poata fi trimise prin
   * `FormData` intr-un `<form action=...>` (ecranul /comenzi/nou). `false`
   * (implicit) -> doar starea controlata conteaza - folosit de cardul de
   * confirmare al asistentului (`order-draft-card.tsx`), care NU trece prin
   * submit nativ de formular, ci citeste `value` direct la "Confirmă".
   */
  nativeFormFields?: boolean;
}

/**
 * Editorul de comanda (client + adresa de livrare + data + note + linii cu
 * add/remove) - extras din `OrderForm` ca sa fie REFOLOSIT identic de ecranul
 * `/comenzi/nou` si de cardul de confirmare "creeaza_comanda" al asistentului
 * (docs/plans/asistent-contract-capabilitati.md, obiectivul 4). Complet controlat -
 * nu are stare proprie in afara de draft-ul liniei curente (item+cantitate, inainte
 * de "Adaugă linie").
 */
export function OrderEditor({
  clients,
  addressesByClient,
  itemOptions,
  value,
  onChange,
  nativeFormFields = false,
}: OrderEditorProps) {
  const [draftItemId, setDraftItemId] = useState("");
  const [draftQuantity, setDraftQuantity] = useState("");

  const addresses = value.clientId ? (addressesByClient[value.clientId] ?? []) : [];
  const itemById = useMemo(
    () => new Map(itemOptions.map((item) => [item.id, item] as const)),
    [itemOptions],
  );

  function addLine() {
    const quantity = Number(draftQuantity.replace(",", "."));
    if (!draftItemId || !Number.isFinite(quantity) || quantity <= 0) return;

    onChange({
      ...value,
      lines: [
        ...value.lines,
        { key: `${draftItemId}-${Date.now()}`, itemId: draftItemId, quantity },
      ],
    });
    setDraftItemId("");
    setDraftQuantity("");
  }

  function removeLine(key: string) {
    onChange({ ...value, lines: value.lines.filter((line) => line.key !== key) });
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Client și livrare</CardTitle>
          <CardDescription>Comanda se creează în numele clientului ales.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Client" required>
            {(id) => (
              <select
                id={id}
                name={nativeFormFields ? "client_id" : undefined}
                required={nativeFormFields}
                value={value.clientId}
                onChange={(e) =>
                  onChange({ ...value, clientId: e.target.value, deliveryAddressId: "" })
                }
                className={selectClassName}
              >
                <option value="" disabled>
                  Alege un client...
                </option>
                {clients.map((client) => (
                  <option key={client.id} value={client.id}>
                    {client.name} ({client.cui})
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <FormField
            label="Adresă de livrare"
            hint="Opțional - alege una dintre adresele clientului."
          >
            {(id) => (
              <select
                id={id}
                name={nativeFormFields ? "delivery_address_id" : undefined}
                value={value.deliveryAddressId}
                disabled={!value.clientId}
                onChange={(e) => onChange({ ...value, deliveryAddressId: e.target.value })}
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
              </select>
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Data livrare" hint="Opțional.">
              {(id) => (
                <Input
                  id={id}
                  name={nativeFormFields ? "delivery_date" : undefined}
                  type="date"
                  value={value.deliveryDate}
                  onChange={(e) => onChange({ ...value, deliveryDate: e.target.value })}
                />
              )}
            </FormField>
          </div>

          <FormField label="Note" hint="Opțional.">
            {(id) => (
              <textarea
                id={id}
                name={nativeFormFields ? "notes" : undefined}
                rows={3}
                value={value.notes}
                onChange={(e) => onChange({ ...value, notes: e.target.value })}
                className={textareaClassName}
              />
            )}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linii comandă</CardTitle>
          <CardDescription>Adaugă produse din catalogul vandabil, cu cantitate.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {value.lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nicio linie adăugată încă.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {value.lines.map((line) => {
                const item = itemById.get(line.itemId);
                return (
                  <li key={line.key} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span>{item?.title ?? "-"}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm tabular-nums">
                        {line.quantity} {item?.unit}
                      </span>
                      {nativeFormFields ? (
                        <>
                          <input type="hidden" name="item_id" value={line.itemId} />
                          <input type="hidden" name="quantity" value={line.quantity} />
                        </>
                      ) : null}
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Șterge linia"
                        onClick={() => removeLine(line.key)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <FormField label="Item" className="sm:w-56">
              {(id) => (
                <select
                  id={id}
                  value={draftItemId}
                  onChange={(e) => setDraftItemId(e.target.value)}
                  className={selectClassName}
                >
                  <option value="" disabled>
                    Alege un item...
                  </option>
                  {itemOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title} ({option.unit})
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Cantitate" className="sm:w-28">
              {(id) => (
                <Input
                  id={id}
                  type="number"
                  min="0"
                  step="0.001"
                  value={draftQuantity}
                  onChange={(e) => setDraftQuantity(e.target.value)}
                />
              )}
            </FormField>
            <Button type="button" variant="outline" onClick={addLine}>
              Adaugă linie
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
