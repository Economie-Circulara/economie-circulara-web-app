import type { OrderStatus } from "./types";

/**
 * Masina de stari a comenzii (AGENTS.md §4 + mockup): draft -> sent -> accepted ->
 * delivered -> closed, plus anulare (-> cancelled) din draft/sent/accepted. Fara
 * livrari partiale — o comanda trece intreaga dintr-un status in altul, niciodata
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

/** Statusurile in care se poate afla o comanda anulabila (buton „Anulează”). */
export function isCancellable(status: OrderStatus): boolean {
  return canTransitionOrder(status, "cancelled");
}
