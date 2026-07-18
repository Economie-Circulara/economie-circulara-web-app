"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptReturnAction } from "./actions";

/**
 * Buton „Acceptă retur” — doar pt. comenzi-retur `draft` (vezi
 * `(admin)/comenzi/[id]/page.tsx`, care randeaza acest buton in locul
 * `OrderStatusActions` generic cand comanda are o legatura return/warranty).
 * `acceptReturnAction` ia direct `returnOrderId` (nu FormData) — apelat din
 * `onClick`, in `useTransition`, la fel ca `ReturnActions`.
 */
export function AcceptReturnButton({ returnOrderId }: { returnOrderId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      const result = await acceptReturnAction(returnOrderId);
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
        {pending ? "Se acceptă..." : "Acceptă retur"}
      </Button>
      {error ? <span className="max-w-48 text-right text-xs text-danger">{error}</span> : null}
    </div>
  );
}
