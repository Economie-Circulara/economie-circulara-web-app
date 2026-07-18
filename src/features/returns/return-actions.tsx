"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { createReturnAction } from "./actions";
import type { ReturnableItem, ReturnFlowType } from "./types";

/**
 * `createReturnAction` primeste un obiect simplu (nu `FormData`) — semnatura
 * fixata de contractul consumat si de Task H (vezi actions.ts) — deci acest
 * formular NU foloseste `useActionState`/`<form action=...>` ca in
 * `orders/order-status-actions.tsx`; apeleaza direct server action-ul din
 * `onClick`, in interiorul unui `useTransition` (pattern standard Next.js pt.
 * server actions apelate din event handlers, nu din submit de formular).
 */
export function ReturnActions({
  originalOrderId,
  returnableItems,
  redirectBasePath = "/comenzi",
}: {
  originalOrderId: string;
  returnableItems: ReturnableItem[];
  /**
   * Ruta de baza spre care se navigheaza dupa crearea returului. Admin: `/comenzi`
   * (implicit); portalul clientului (Task H) paseaza `/comenzile-mele`, ruta lui.
   */
  redirectBasePath?: string;
}) {
  const router = useRouter();
  const [openType, setOpenType] = useState<ReturnFlowType | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const hasReturnable = returnableItems.some((item) => item.returnableQuantity > 0);
  if (!hasReturnable && openType === null) {
    return null;
  }

  function openForm(type: ReturnFlowType) {
    setOpenType(type);
    setError(null);
    setQuantities({});
    setNotes("");
  }

  function closeForm() {
    setOpenType(null);
    setError(null);
  }

  function submit() {
    if (!openType) return;

    const items = returnableItems
      .map((item) => ({
        orderItemId: item.orderItemId,
        quantity: Number((quantities[item.orderItemId] ?? "").replace(",", ".")),
      }))
      .filter((line) => Number.isFinite(line.quantity) && line.quantity > 0);

    if (items.length === 0) {
      setError("Introdu o cantitate pentru cel puțin un item.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const result = await createReturnAction({
        originalOrderId,
        type: openType,
        items,
        notes: notes.trim() ? notes.trim() : undefined,
      });

      if ("error" in result) {
        setError(result.error);
        return;
      }

      setOpenType(null);
      router.push(`${redirectBasePath}/${result.returnOrderId}`);
      router.refresh();
    });
  }

  if (openType === null) {
    return (
      <div className="flex gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => openForm("return")}>
          Retur
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => openForm("warranty")}>
          Garanție
        </Button>
      </div>
    );
  }

  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">
          {openType === "warranty" ? "Garanție (retur + înlocuire)" : "Retur"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {returnableItems
            .filter((item) => item.returnableQuantity > 0)
            .map((item) => (
              <li key={item.orderItemId}>
                <FormField
                  label={item.itemTitle}
                  hint={`Max. returnabil: ${item.returnableQuantity} ${item.unit}`}
                >
                  {(id) => (
                    <Input
                      id={id}
                      type="number"
                      min="0"
                      max={item.returnableQuantity}
                      step="0.001"
                      value={quantities[item.orderItemId] ?? ""}
                      onChange={(e) =>
                        setQuantities((prev) => ({
                          ...prev,
                          [item.orderItemId]: e.target.value,
                        }))
                      }
                    />
                  )}
                </FormField>
              </li>
            ))}
        </ul>

        <FormField label="Notă" hint="Opțional.">
          {(id) => <Input id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </FormField>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex gap-3">
          <Button type="button" disabled={pending} onClick={submit}>
            {pending ? "Se creează..." : "Creează"}
          </Button>
          <Button type="button" variant="ghost" disabled={pending} onClick={closeForm}>
            Renunță
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
