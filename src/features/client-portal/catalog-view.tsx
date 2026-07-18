"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Minus, Plus, Search, ShoppingCart, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/empty-state";
import { FormField } from "@/components/form-field";
import type { ClientAddress } from "@/features/clients/types";
import { KIND_LABELS } from "@/features/items/labels";
import { initialClientOrderFormState } from "./action-state";
import { createClientOrderAction } from "./actions";
import { useCart } from "./cart-context";
import type { CatalogItem, ItemKind } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

const textareaClassName =
  "flex min-h-20 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function ProductCard({ item }: { item: CatalogItem }) {
  const { lines, addItem } = useCart();
  const inCart = lines.find((l) => l.itemId === item.id);

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex h-32 items-center justify-center border-b bg-muted/40">
        <span className="rounded-md border bg-card px-2 py-1 font-mono text-[10px] text-muted-foreground">
          foto produs
        </span>
      </div>
      <CardContent className="space-y-3 p-3.5">
        <div>
          <p className="text-sm font-bold">{item.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {KIND_LABELS[item.kind]} · UM: {item.unit}
          </p>
        </div>
        <Button
          type="button"
          className="w-full"
          size="sm"
          onClick={() =>
            addItem({ itemId: item.id, itemTitle: item.title, unit: item.unit, quantity: 1 })
          }
        >
          <Plus className="size-4" />
          Adaugă în coș{inCart ? ` (${inCart.quantity})` : ""}
        </Button>
      </CardContent>
    </Card>
  );
}

function CartPanel({ addresses }: { addresses: ClientAddress[] }) {
  const { lines, removeItem, setQuantity, replaceCart } = useCart();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, formAction, actionPending] = useActionState(
    createClientOrderAction,
    initialClientOrderFormState,
  );

  useEffect(() => {
    if (state.orderId && !state.error) {
      replaceCart([]);
      startTransition(() => {
        router.push(`/comenzile-mele/${state.orderId}`);
      });
    }
    // Rulam doar cand `orderId` se schimba (comanda noua trimisa cu succes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.orderId]);

  const pending = actionPending || isPending;

  return (
    <Card className="sticky top-4 overflow-hidden p-0">
      <div className="flex items-center justify-between border-b px-4 py-3.5">
        <p className="text-sm font-bold">Coș</p>
        <span className="font-mono text-xs text-muted-foreground">{lines.length} produse</span>
      </div>

      {lines.length === 0 ? (
        <CardContent className="p-4">
          <EmptyState
            icon={<ShoppingCart />}
            title="Coșul este gol"
            description="Adaugă produse din catalog pentru a trimite o comandă."
          />
        </CardContent>
      ) : (
        <form action={formAction}>
          <div className="max-h-72 space-y-0 overflow-y-auto px-4">
            {lines.map((line) => (
              <div key={line.itemId} className="border-b py-3 last:border-b-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{line.itemTitle}</span>
                  <button
                    type="button"
                    aria-label="Scoate din coș"
                    onClick={() => removeItem(line.itemId)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center overflow-hidden rounded-md border">
                    <button
                      type="button"
                      aria-label="Scade cantitatea"
                      className="flex size-7 items-center justify-center bg-secondary"
                      onClick={() => setQuantity(line.itemId, line.quantity - 1)}
                    >
                      <Minus className="size-3.5" />
                    </button>
                    <span className="w-10 text-center font-mono text-xs font-bold tabular-nums">
                      {line.quantity}
                    </span>
                    <button
                      type="button"
                      aria-label="Crește cantitatea"
                      className="flex size-7 items-center justify-center bg-secondary"
                      onClick={() => setQuantity(line.itemId, line.quantity + 1)}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-muted-foreground">{line.unit}</span>
                </div>
                <input type="hidden" name="item_id" value={line.itemId} />
                <input type="hidden" name="quantity" value={line.quantity} />
              </div>
            ))}
          </div>

          <div className="space-y-3 border-t p-4">
            <FormField label="Adresă livrare" hint="Opțional.">
              {(id) => (
                <select
                  id={id}
                  name="delivery_address_id"
                  defaultValue=""
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

            <FormField label="Data livrare" hint="Opțional.">
              {(id) => <Input id={id} name="delivery_date" type="date" />}
            </FormField>

            <FormField label="Observații" hint="Opțional.">
              {(id) => <textarea id={id} name="notes" rows={2} className={textareaClassName} />}
            </FormField>

            {state.error ? <p className="text-xs text-danger">{state.error}</p> : null}

            <Button type="submit" variant="accent" className="w-full" disabled={pending}>
              {pending ? "Se trimite..." : "Trimite comanda"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

export interface CatalogViewProps {
  items: CatalogItem[];
  addresses: ClientAddress[];
}

const KIND_FILTER_OPTIONS: ItemKind[] = ["physical", "service"];

/** Ecranul „Catalog" (mockup #CATALOG): grid de carduri + panou coș, fara preturi. */
export function CatalogView({ items, addresses }: CatalogViewProps) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<ItemKind | "">("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (kind && item.kind !== kind) return false;
      if (q && !item.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, search, kind]);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_330px]">
      <div>
        <div className="mb-5 flex gap-2.5">
          <div className="flex flex-1 items-center gap-2 rounded-md border bg-card px-3 py-2">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Caută în catalog…"
              className="w-full border-none bg-transparent text-sm outline-none"
            />
          </div>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ItemKind | "")}
            className={`${selectClassName} w-56`}
          >
            <option value="">Toate categoriile</option>
            {KIND_FILTER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {KIND_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart />}
            title="Niciun produs găsit"
            description="Încearcă alți termeni de căutare sau altă categorie."
          />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-4">
            {filtered.map((item) => (
              <ProductCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>

      <CartPanel addresses={addresses} />
    </div>
  );
}
