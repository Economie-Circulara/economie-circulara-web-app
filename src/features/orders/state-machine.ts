import type { OrderLinkType, OrderStatus, OrderType } from "./types";

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
 * Fluxul unei comenzi: `sale` (vanzare - masina de stari completa) sau `intake`
 * (comenzi care CREEAZA stoc: aport - 0031/0042 - si comenzile-retur/garantie -
 * 0010/0044). Un `intake` se accepta DOAR prin RPC-ul dedicat (butoanele "Acceptă
 * aport" / "Acceptă retur") si nu trece prin sent -> delivered -> closed.
 */
export type OrderFlow = "sale" | "intake";

/** Fluxul comenzii din tipul ei si din legatura cu comanda originala (`order_links`). */
export function orderFlowOf(
  orderType: OrderType,
  linkType: OrderLinkType | null | undefined,
): OrderFlow {
  return orderType === "aport" || linkType === "return" || linkType === "warranty"
    ? "intake"
    : "sale";
}

/**
 * Tranzitiile GENERICE (butoanele din `OrderStatusActions`) permise intr-un flux.
 * Pe `intake` doar anularea (respingerea cererii), cat timp nimic n-a intrat in
 * stoc (`draft`/`sent`). Anularea unui intake acceptat ar lasa loturile create in
 * stoc - interzisa si in DB (gardele AP005 / RT005, 0042 / 0044).
 */
export function canTransitionOrderInFlow(
  from: OrderStatus,
  to: OrderStatus,
  flow: OrderFlow,
): boolean {
  if (flow === "intake") {
    return to === "cancelled" && (from === "draft" || from === "sent");
  }
  return canTransitionOrder(from, to);
}

/**
 * Un intake (aport / retur / garantie) se accepta din `draft` (creat de staff) sau
 * `sent` (trimis din portalul clientului).
 */
export function canAcceptIntake(status: OrderStatus): boolean {
  return status === "draft" || status === "sent";
}
