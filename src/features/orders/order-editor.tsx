"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import type { Client, ClientAddress } from "@/features/clients/types";
import type { ItemOption } from "@/features/items/types";
import { ORDER_TYPE_DESCRIPTIONS, ORDER_TYPE_LABELS, ORDER_TYPE_OPTIONS } from "./labels";
import type { OrderType } from "./types";

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
  /**
   * Tipul comenzii. `""` = inca nealeasa - deliberat NU exista un default in UI
   * (vezi migrarea 0030): alegerea trebuie facuta explicit, pentru ca sensul
   * stocului depinde de ea. Default-ul din DB e doar plasa de siguranta pentru
   * insert-urile care nu trec pe aici (seed-uri, comenzi-retur).
   */
  orderType: OrderType | "";
  clientId: string;
  deliveryAddressId: string;
  deliveryDate: string;
  /** Data estimata de retur - se trimite doar cand `orderType === "serviciu"`. */
  expectedReturnDate: string;
  notes: string;
  lines: OrderEditorLine[];
}

export function emptyOrderEditorValue(): OrderEditorValue {
  return {
    orderType: "",
    clientId: "",
    deliveryAddressId: "",
    deliveryDate: "",
    expectedReturnDate: "",
    notes: "",
    lines: [],
  };
}

export interface OrderEditorProps {
  clients: Client[];
  /** Adresele fiecarui client, precalculate - evita un fetch suplimentar la schimbarea clientului. */
  addressesByClient: Record<string, ClientAddress[]>;
  /** Itemi vandabili (catalog client) - liniile permise pe o comanda `material`/`serviciu`. */
  itemOptions: ItemOption[];
  /**
   * Itemii oferiti pe o comanda de tip `aport` (orice item FIZIC, si nevandabil -
   * vezi `listIntakeItemOptions`). Optional: cand lipseste (ex. cardul
   * asistentului, care incarca doar catalogul vandabil), se cade inapoi pe
   * `itemOptions` - aportul ramane creabil, doar cu o lista mai restransa.
   */
  intakeItemOptions?: ItemOption[];
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
  intakeItemOptions,
  value,
  onChange,
  nativeFormFields = false,
}: OrderEditorProps) {
  const [draftItemId, setDraftItemId] = useState("");
  const [draftQuantity, setDraftQuantity] = useState("");

  const addresses = value.clientId ? (addressesByClient[value.clientId] ?? []) : [];

  // Lista de itemi depinde de tipul comenzii: `material`/`serviciu` pastreaza
  // catalogul vandabil de pana acum, `aport` ofera itemii fizici (inclusiv
  // nevandabili - vezi `listIntakeItemOptions`).
  const availableItems =
    value.orderType === "aport" ? (intakeItemOptions ?? itemOptions) : itemOptions;
  // Denumirile liniilor deja adaugate se rezolva din AMBELE liste: la schimbarea
  // tipului, liniile raman in draft si trebuie sa se afiseze in continuare corect.
  const itemById = useMemo(
    () => new Map([...itemOptions, ...(intakeItemOptions ?? [])].map((i) => [i.id, i] as const)),
    [itemOptions, intakeItemOptions],
  );

  function addLine() {
    const quantity = Number(draftQuantity.replace(",", "."));
    // Fara tip ales nu stim din ce catalog provine linia - selectorul de item e
    // oricum dezactivat, garda de aici acopera si apelul programatic.
    if (!value.orderType || !draftItemId || !Number.isFinite(quantity) || quantity <= 0) return;

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

  function changeOrderType(next: OrderType) {
    const directionChanged = (value.orderType === "aport") !== (next === "aport");
    onChange({
      ...value,
      orderType: next,
      // Data de retur are sens doar la `serviciu` - o golim ca sa nu plece pe server
      // o valoare ramasa de la o alegere anterioara.
      expectedReturnDate: next === "serviciu" ? value.expectedReturnDate : "",
      // Aportul foloseste ALT catalog (itemi fizici, si nevandabili). La schimbarea
      // sensului comenzii, liniile deja adaugate pot proveni din catalogul gresit,
      // asa ca se golesc - intre `material` si `serviciu` raman neatinse.
      lines: directionChanged ? [] : value.lines,
    });
    setDraftItemId("");
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Tip comandă</CardTitle>
          <CardDescription>
            Determină sensul mișcării de stoc - alege înainte de a adăuga linii.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <fieldset className="space-y-2">
            <legend className="sr-only">Tip comandă</legend>
            {ORDER_TYPE_OPTIONS.map((type) => (
              <label
                key={type}
                className="flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm has-checked:border-primary"
              >
                <input
                  type="radio"
                  name="order_type"
                  value={type}
                  required={nativeFormFields}
                  checked={value.orderType === type}
                  onChange={() => changeOrderType(type)}
                  className="mt-0.5"
                />
                <span>
                  <span className="font-medium">{ORDER_TYPE_LABELS[type]}</span>
                  <span className="block text-xs text-muted-foreground">
                    {ORDER_TYPE_DESCRIPTIONS[type]}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        </CardContent>
      </Card>

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
            <FormField
              label={value.orderType === "aport" ? "Data aportului" : "Data livrare"}
              hint="Opțional."
            >
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

            {/* `expected_return_date` (coloana existenta din 0001, pana acum fara UI)
                e relevanta DOAR pentru inchiriere/PaaS - de aceea apare exclusiv la
                tipul `serviciu` (vezi migrarea 0030 si `createOrderWithItems`, care
                oricum o ignora pentru celelalte tipuri). */}
            {value.orderType === "serviciu" ? (
              <FormField label="Retur estimat" hint="Opțional - data la care bunul se întoarce.">
                {(id) => (
                  <Input
                    id={id}
                    name={nativeFormFields ? "expected_return_date" : undefined}
                    type="date"
                    value={value.expectedReturnDate}
                    onChange={(e) => onChange({ ...value, expectedReturnDate: e.target.value })}
                  />
                )}
              </FormField>
            ) : null}
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
          <CardDescription>
            {value.orderType === "aport"
              ? "Adaugă materialele aduse de client, cu cantitate."
              : "Adaugă produse din catalogul vandabil, cu cantitate."}
          </CardDescription>
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
                  disabled={!value.orderType}
                  onChange={(e) => setDraftItemId(e.target.value)}
                  className={selectClassName}
                >
                  <option value="" disabled>
                    {value.orderType ? "Alege un item..." : "Alege întâi tipul comenzii..."}
                  </option>
                  {availableItems.map((option) => (
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
