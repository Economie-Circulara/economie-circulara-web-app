"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Recycle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import type { ClientAddress } from "@/features/clients/types";
import type { ItemOption } from "@/features/items/types";
import { initialClientOrderFormState } from "./action-state";
import { createClientAportAction } from "./actions";
import { DeliveryAddressField } from "./delivery-address-field";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const textareaClassName =
  "flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

/** O linie a cererii de aport - stare locala (nu partajeaza `useCart`, cosul e doar pt. vanzare). */
interface AportLine {
  key: string;
  itemId: string;
  itemTitle: string;
  unit: ItemOption["unit"];
  quantity: number;
}

export interface AportFormProps {
  /** Itemi fizici trasati (catalogul de aport - `listIntakeItemOptions`, vizibil clientului via `items_client_intake`). */
  items: ItemOption[];
  addresses: ClientAddress[];
}

/**
 * Formularul "Aport material" (client-> organizatie): o singura pagina, fara
 * cosul de vanzare (`useCart`/`CartProvider` raman scope-ul /catalog). Liniile
 * traiesc doar in starea locala a acestui component pana la submit - la fel ca
 * `OrderEditor` (aceeasi idee de add/remove linie), dar fara selectorul de client/
 * tip comanda (aportul portalului e mereu in numele clientului curent).
 */
export function AportForm({ items, addresses }: AportFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, formAction, actionPending] = useActionState(
    createClientAportAction,
    initialClientOrderFormState,
  );

  const [lines, setLines] = useState<AportLine[]>([]);
  const [draftItemId, setDraftItemId] = useState("");
  const [draftQuantity, setDraftQuantity] = useState("");

  const itemById = useMemo(() => new Map(items.map((item) => [item.id, item] as const)), [items]);

  useEffect(() => {
    if (state.orderId && !state.error) {
      startTransition(() => {
        router.push(`/comenzile-mele/${state.orderId}`);
      });
    }
    // Rulam doar cand `orderId` se schimba (cererea trimisa cu succes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.orderId]);

  const pending = actionPending || isPending;

  function addLine() {
    const item = itemById.get(draftItemId);
    const quantity = Number(draftQuantity.replace(",", "."));
    if (!item || !Number.isFinite(quantity) || quantity <= 0) return;

    setLines((prev) => [
      ...prev,
      {
        key: `${item.id}-${Date.now()}`,
        itemId: item.id,
        itemTitle: item.title,
        unit: item.unit,
        quantity,
      },
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
          <CardTitle className="text-base">Materiale aduse</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {lines.length === 0 ? (
            <EmptyState
              icon={<Recycle />}
              title="Niciun material adăugat încă"
              description="Alege un material din listă și o cantitate estimată, apoi apasă „Adaugă”."
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {lines.map((line) => (
                <li
                  key={line.key}
                  className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
                >
                  <span>{line.itemTitle}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums">
                      {line.quantity} {line.unit}
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
              ))}
            </ul>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
            <FormField label="Material" className="sm:w-56">
              {(id) => (
                <select
                  id={id}
                  value={draftItemId}
                  onChange={(e) => setDraftItemId(e.target.value)}
                  className={selectClassName}
                >
                  <option value="" disabled>
                    Alege un material...
                  </option>
                  {items.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title} ({option.unit})
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Cantitate estimată" className="sm:w-32">
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
              <Plus className="size-4" />
              Adaugă
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalii aport</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <DeliveryAddressField addresses={addresses} label="Adresă" hint="Opțional." />

          <FormField label="Dată dorită" hint="Opțional - când poți aduce materialul.">
            {(id) => <Input id={id} name="delivery_date" type="date" />}
          </FormField>

          <FormField label="Observații" hint="Opțional.">
            {(id) => <textarea id={id} name="notes" rows={3} className={textareaClassName} />}
          </FormField>
        </CardContent>
      </Card>

      {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

      <div className="flex gap-3">
        <Button type="submit" variant="accent" disabled={pending || lines.length === 0}>
          {pending ? "Se trimite..." : "Trimite cererea de aport"}
        </Button>
      </div>
    </form>
  );
}
