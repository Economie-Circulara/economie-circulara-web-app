"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptIntakeAction } from "./actions";

/**
 * Buton "Acceptă aport" - doar pt. comenzile de tip `aport` aflate in `draft` sau `sent`
 * (vezi `(admin)/comenzi/[id]/page.tsx`, care il randeaza in locul
 * `OrderStatusActions` generic: "Acceptă" acolo CONSUMA stoc, exact invers fata
 * de un aport). Acelasi tipar ca `features/returns/accept-return-button.tsx` -
 * traieste totusi in `features/orders/` pentru ca aportul NU e o comanda legata
 * de alta (nu are `order_links`), ci un tip de comanda de sine statator.
 */
export function AcceptIntakeButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptIntakeAction(orderId);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="inline-flex flex-col items-end gap-1">
      <Button type="button" size="sm" disabled={pending} onClick={accept}>
        {pending ? "Se acceptă..." : "Acceptă aport"}
      </Button>
      {error ? <span className="max-w-48 text-right text-xs text-danger">{error}</span> : null}
    </div>
  );
}
