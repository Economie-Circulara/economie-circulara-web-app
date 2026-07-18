import type { OrderItemRow } from "@/features/orders/types";
import type { CartLine } from "./types";

/**
 * Logica PURA a cosului (fara React/localStorage) — usor de testat, folosita atat
 * de `cart-context.tsx` (reducer) cat si direct in teste.
 */

/** Adauga un item nou sau incrementeaza cantitatea daca itemul e deja in cos. */
export function addLine(lines: CartLine[], line: CartLine): CartLine[] {
  const existing = lines.find((l) => l.itemId === line.itemId);
  if (existing) {
    return lines.map((l) =>
      l.itemId === line.itemId ? { ...l, quantity: l.quantity + line.quantity } : l,
    );
  }
  return [...lines, line];
}

/** Scoate complet un item din cos. */
export function removeLine(lines: CartLine[], itemId: string): CartLine[] {
  return lines.filter((l) => l.itemId !== itemId);
}

/**
 * Seteaza cantitatea unei linii. O cantitate `<= 0` scoate linia din cos (acelasi
 * comportament ca butonul „−” dus la capat, in mockup).
 */
export function setQuantity(lines: CartLine[], itemId: string, quantity: number): CartLine[] {
  if (quantity <= 0) return removeLine(lines, itemId);
  return lines.map((l) => (l.itemId === itemId ? { ...l, quantity } : l));
}

/** Numarul de produse distincte din cos (afisat in header-ul panoului „Coș"). */
export function totalLines(lines: CartLine[]): number {
  return lines.length;
}

/** Suma cantitatilor din cos (toate liniile, indiferent de UM). */
export function totalQuantity(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0);
}

/**
 * Reconstruieste liniile de cos dintr-o comanda existenta (butonul „Repetă
 * comanda" din /comenzile-mele) — precompleteaza cosul cu aceiasi itemi/cantitati.
 */
export function linesFromOrder(items: OrderItemRow[]): CartLine[] {
  return items.map((item) => ({
    itemId: item.itemId,
    itemTitle: item.itemTitle,
    unit: item.unit,
    quantity: item.quantity,
  }));
}
