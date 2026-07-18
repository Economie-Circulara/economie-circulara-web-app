"use client";

import { useActionState, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import type { Client, ClientAddress } from "@/features/clients/types";
import type { ItemOption } from "@/features/items/types";
import { initialOrderFormState } from "./action-state";
import { createOrderAction } from "./actions";
import type { OrderLineInput } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const textareaClassName =
  "flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface OrderLine extends OrderLineInput {
  /** Cheie stabila pentru randare — nu se refoloseste `itemId` (acelasi item se poate cumula manual). */
  key: string;
}

interface OrderFormProps {
  clients: Client[];
  /** Adresele fiecarui client, precalculate — evita un fetch suplimentar la schimbarea clientului. */
  addressesByClient: Record<string, ClientAddress[]>;
  /** Itemi vandabili (catalog client) — singurele linii permise intr-o comanda. */
  itemOptions: ItemOption[];
}

/**
 * Formular creare comanda in numele unui client (`created_by_admin=true`, ecranul
 * /comenzi/nou): alege client + adresa de livrare (dependenta de client) + data
 * livrare optionala, apoi adauga linii (item vandabil + cantitate) intr-un "cos"
 * local inainte de a trimite formularul o singura data (liniile ajung la server
 * ca perechi repetate `item_id`/`quantity`, vezi `readLines` in actions.ts).
 */
export function OrderForm({ clients, addressesByClient, itemOptions }: OrderFormProps) {
  const [state, formAction, pending] = useActionState(createOrderAction, initialOrderFormState);

  const [clientId, setClientId] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);

  const [draftItemId, setDraftItemId] = useState("");
  const [draftQuantity, setDraftQuantity] = useState("");

  const addresses = clientId ? (addressesByClient[clientId] ?? []) : [];
  const itemTitleById = useMemo(
    () => new Map(itemOptions.map((item) => [item.id, item] as const)),
    [itemOptions],
  );

  function addLine() {
    const quantity = Number(draftQuantity.replace(",", "."));
    if (!draftItemId || !Number.isFinite(quantity) || quantity <= 0) return;

    setLines((prev) => [
      ...prev,
      { key: `${draftItemId}-${Date.now()}`, itemId: draftItemId, quantity },
    ]);
    setDraftItemId("");
    setDraftQuantity("");
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((line) => line.key !== key));
  }

  return (
    <form action={formAction} className="max-w-2xl space-y-6">
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
                name="client_id"
                required
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
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
            hint="Opțional — alege una dintre adresele clientului."
          >
            {(id) => (
              <select
                id={id}
                name="delivery_address_id"
                defaultValue=""
                disabled={!clientId}
                className={selectClassName}
              >
                <option value="">Fără adresă precizată</option>
                {addresses.map((address) => (
                  <option key={address.id} value={address.id}>
                    {address.label ? `${address.label} — ` : ""}
                    {address.address}
                    {address.isDefault ? " (implicită)" : ""}
                  </option>
                ))}
              </select>
            )}
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Data livrare" hint="Opțional.">
              {(id) => <Input id={id} name="delivery_date" type="date" />}
            </FormField>
          </div>

          <FormField label="Note" hint="Opțional.">
            {(id) => <textarea id={id} name="notes" rows={3} className={textareaClassName} />}
          </FormField>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Linii comandă</CardTitle>
          <CardDescription>Adaugă produse din catalogul vandabil, cu cantitate.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nicio linie adăugată încă.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {lines.map((line) => {
                const item = itemTitleById.get(line.itemId);
                return (
                  <li key={line.key} className="flex items-center justify-between gap-3 px-4 py-2">
                    <span>{item?.title ?? "—"}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm tabular-nums">
                        {line.quantity} {item?.unit}
                      </span>
                      <input type="hidden" name="item_id" value={line.itemId} />
                      <input type="hidden" name="quantity" value={line.quantity} />
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

          <div className="flex flex-wrap items-end gap-3">
            <FormField label="Item" className="w-56">
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
            <FormField label="Cantitate" className="w-28">
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

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" disabled={pending || lines.length === 0}>
          {pending ? "Se creează..." : "Creează comanda"}
        </Button>
      </div>
    </form>
  );
}
