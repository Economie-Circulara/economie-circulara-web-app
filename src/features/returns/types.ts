import type { Database } from "@/lib/database.types";

export type OrderLinkType = Database["public"]["Enums"]["order_link_type"];
export type OrderType = Database["public"]["Enums"]["order_type"];
export type UnitOfMeasure = Database["public"]["Enums"]["unit_of_measure"];

/** Tipul de flux disponibil din UI - "replacement" nu se creeaza direct (efect al "warranty"). */
export type ReturnFlowType = Extract<OrderLinkType, "return" | "warranty">;

/**
 * Ce fluxuri sunt permise, in functie de TIPUL comenzii originale (migrarea 0030).
 * Regula de business (decizie 2026-09, vezi AGENTS.md §4):
 *
 *   - `return` (retur pur: marfa se intoarce in stoc, fara inlocuire) are sens
 *     DOAR pe o comanda `serviciu` - o inchiriere/PaaS se incheie prin returnarea
 *     bunului. O vanzare de material (`material`) e o tranzactie intr-un singur
 *     sens: nu se "returneaza" pur si simplu.
 *   - `warranty` (retur + comanda de inlocuire) ramane posibila si pe `material`:
 *     un produs fizic defect trebuie inlocuit, indiferent ca a fost vandut sau
 *     inchiriat.
 *   - `aport` nu accepta niciun flux: materialul a venit DE LA client, nu catre el.
 *
 * Aceasta e o RESTRANGERE fata de comportamentul de pana acum (orice comanda
 * `delivered`/`closed` accepta ambele fluxuri); verificarea de status ramane in
 * plus, nu in locul acesteia.
 */
/**
 * Ce fluxuri de retur/garanție sunt permise, in functie de tipul comenzii
 * originale (migrarea 0030). Decizie initiala (Task X8): `return` pur doar pe
 * `serviciu` - dar datele demo (supabase/demo/seed-demo.sql) au aratat ca
 * exceptii legitime de "retur" exista si pe `material`: retur de AMBALAJE
 * (paleti EURO - un sistem de garantie/schimb standard in materiale de
 * constructii, nu o vanzare a paletului insusi) si retur de SURPLUS nefolosit.
 * Diferenta reala fata de `serviciu` nu e "poate avea retur", ci e ca la
 * `serviciu` returul e AsTEPTAT DE LA INCEPUT (`expectedReturnDate` completat la
 * creare) - la `material` e o exceptie de la fluxul normal (o singura data,
 * ambalaj sau surplus), nu regula. `aport` ramane exclus din ambele: e deja un
 * flux de intrare, "returul" unui aport n-ar avea sens fara o comanda noua.
 */
export const ALLOWED_RETURN_FLOWS_BY_ORDER_TYPE: Record<OrderType, ReturnFlowType[]> = {
  material: ["return", "warranty"],
  serviciu: ["return", "warranty"],
  aport: [],
};

/** O linie ceruta la crearea unei comenzi-retur/garanție (cantitati editabile, pot fi partiale). */
export interface ReturnItemInput {
  /** Id-ul liniei (`order_items.id`) din comanda ORIGINALA care se returneaza. */
  orderItemId: string;
  quantity: number;
}

/** Input-ul `createReturnAction` - interfata publica consumata si de Task H (portal client). */
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

/** Rezultatul `acceptReturnAction` - FormState-style, ca `OrderTransitionState`. */
export interface AcceptReturnResult {
  error: string | null;
}

/** Itemul unei comenzi finalizate, cu cantitatea inca returnabila (`getReturnableItems`). */
export interface ReturnableItem {
  orderItemId: string;
  itemId: string;
  itemTitle: string;
  unit: UnitOfMeasure;
  /** Cantitatea din linia originala (livrata - fara livrari partiale, vezi AGENTS.md). */
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
