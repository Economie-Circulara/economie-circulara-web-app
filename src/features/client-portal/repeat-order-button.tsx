"use client";

import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { OrderItemRow } from "@/features/orders/types";
import { linesFromOrder } from "./cart-logic";
import { useCart } from "./cart-context";

/**
 * Buton „Repetă comanda" (ecranul de detaliu /comenzile-mele/[id]): precompleteaza
 * cosul clientului cu aceiasi itemi/cantitati dintr-o comanda veche, apoi
 * navigheaza la /catalog ca sa treaca prin formularul normal de trimitere
 * (adresa/data/observatii se aleg din nou — nu se copiaza automat).
 */
export function RepeatOrderButton({ items }: { items: OrderItemRow[] }) {
  const { replaceCart } = useCart();
  const router = useRouter();

  function handleClick() {
    replaceCart(linesFromOrder(items));
    router.push("/catalog");
  }

  return (
    <Button type="button" variant="outline" onClick={handleClick} disabled={items.length === 0}>
      <RotateCcw className="size-4" />
      Repetă comanda
    </Button>
  );
}
