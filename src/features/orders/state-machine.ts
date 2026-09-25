import type { OrderStatus, OrderType } from "./types";

/**
 * Masina de stari a comenzii (AGENTS.md §4 + mockup): draft -> sent -> accepted ->
 * delivered -> closed, plus anulare (-> cancelled) din draft/sent/accepted. Fara
 * livrari partiale - o comanda trece intreaga dintr-un status in altul, niciodata
 * pe bucati. `delivered`/`closed` sunt stari terminale pentru anulare (o comanda
 * livrata/inchisa nu se mai poate anula).
 */
const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["sent", "cancelled"],
  sent: ["accepted", "cancelled"],
  accepted: ["delivered", "cancelled"],
  delivered: ["closed"],
  closed: [],
  cancelled: [],
};

/** Comanda nu poate trece din statusul curent in cel cerut. */
export class InvalidOrderTransitionError extends Error {
  constructor(
    public readonly from: OrderStatus,
    public readonly to: OrderStatus,
  ) {
    super(`Comanda nu poate trece din statusul "${from}" in "${to}".`);
    this.name = "InvalidOrderTransitionError";
  }
}

/** `true` daca tranzitia `from` -> `to` e permisa de masina de stari. */
export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Arunca `InvalidOrderTransitionError` daca tranzitia nu e permisa. */
export function assertOrderTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransitionOrder(from, to)) {
    throw new InvalidOrderTransitionError(from, to);
  }
}

/** Statusurile in care se poate afla o comanda anulabila (buton "Anulează"). */
export function isCancellable(status: OrderStatus): boolean {
  return canTransitionOrder(status, "cancelled");
}

/**
 * Tranzitiile GENERICE (butoanele din `OrderStatusActions`) permise pentru o comanda
 * de un anumit tip. O comanda `aport` nu parcurge masina de stari de vanzare
 * (migrarile 0031/0042): se accepta DOAR prin `accept_intake_order` (buton dedicat
 * "Acceptă aport"), iar generic se poate doar anula cat timp nu a intrat in stoc
 * (`draft`/`sent`). Anularea unui aport acceptat ar lasa loturile create in stoc -
 * interzisa si in DB (garda AP005, 0042).
 */
export function canTransitionOrderOfType(
  from: OrderStatus,
  to: OrderStatus,
  orderType: OrderType,
): boolean {
  if (orderType === "aport") {
    return to === "cancelled" && (from === "draft" || from === "sent");
  }
  return canTransitionOrder(from, to);
}

/** Aportul se accepta (intra in stoc) din `draft` (creat de staff) sau `sent` (trimis din portal). */
export function canAcceptIntake(status: OrderStatus): boolean {
  return status === "draft" || status === "sent";
}
