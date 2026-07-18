import type { Database } from "@/lib/database.types";

export type OrderLinkType = Database["public"]["Enums"]["order_link_type"];
export type UnitOfMeasure = Database["public"]["Enums"]["unit_of_measure"];

/** Tipul de flux disponibil din UI — "replacement" nu se creeaza direct (efect al "warranty"). */
export type ReturnFlowType = Extract<OrderLinkType, "return" | "warranty">;

/** O linie ceruta la crearea unei comenzi-retur/garanție (cantitati editabile, pot fi partiale). */
export interface ReturnItemInput {
  /** Id-ul liniei (`order_items.id`) din comanda ORIGINALA care se returneaza. */
  orderItemId: string;
  quantity: number;
}

/** Input-ul `createReturnAction` — interfata publica consumata si de Task H (portal client). */
export interface CreateReturnInput {
  originalOrderId: string;
  type: ReturnFlowType;
  items: ReturnItemInput[];
  notes?: string;
}

/**
 * Rezultatul `createReturnAction`: fie comanda-retur creata (+ comanda de
 * inlocuire, doar pt. "warranty"), fie o eroare tipizata (FormState-style, ca
 * `OrderFormState` din features/orders/action-state.ts).
 */
export type CreateReturnResult =
  | { returnOrderId: string; replacementOrderId: string | null }
  | { error: string };

/** Rezultatul `acceptReturnAction` — FormState-style, ca `OrderTransitionState`. */
export interface AcceptReturnResult {
  error: string | null;
}

/** Itemul unei comenzi finalizate, cu cantitatea inca returnabila (`getReturnableItems`). */
export interface ReturnableItem {
  orderItemId: string;
  itemId: string;
  itemTitle: string;
  unit: UnitOfMeasure;
  /** Cantitatea din linia originala (livrata — fara livrari partiale, vezi AGENTS.md). */
  orderedQuantity: number;
  /** Suma cantitatilor deja cerute in comenzi-retur/garantie NEANULATE pentru acest item. */
  alreadyReturnedQuantity: number;
  /** `orderedQuantity - alreadyReturnedQuantity`, clamped la 0. */
  returnableQuantity: number;
}

/** Legatura de retur/garantie/inlocuire a unei comenzi, daca exista (`getReturnLinkForOrder`). */
export interface OrderReturnLink {
  linkType: OrderLinkType;
  originalOrderId: string;
}
