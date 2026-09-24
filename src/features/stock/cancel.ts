import type { Lot, LotTraceability, StockEventType } from "./types";

/**
 * Evenimentele care NU inseamna "s-a folosit ceva din lot": intrarea initiala si
 * blocarea/deblocarea (cantitate 0). Orice alt eveniment (consum, ajustare,
 * stornare) face lotul ne-anulabil.
 */
const NEUTRAL_EVENTS: readonly StockEventType[] = ["intake", "block", "unblock"];

export interface CancelLotEligibility {
  allowed: boolean;
  /** Motivul pentru care NU se poate anula (text pentru UI), `null` daca e permis. */
  reason: string | null;
}

/**
 * Regula PURA "se poate anula lotul?" (migrarea 0035) - oglinda exacta a verificarilor
 * din RPC-ul `cancel_lot` (sursa de adevar la scriere), folosita ca UI-ul sa arate
 * butonul "Anulează lotul" doar cand chiar are sens si sa explice de ce nu, altfel.
 *
 * Un lot se anuleaza doar daca a fost introdus manual din greseala si NIMIC nu s-a
 * consumat din el; loturile nascute dintr-un flux (proces, retur, aport) se
 * corecteaza din fluxul respectiv, nu izolat.
 */
export function canCancelLot(
  lot: Pick<Lot, "cancelledAt" | "remainingQty" | "initialQty" | "provenance" | "clientId">,
  eventTypes: StockEventType[],
  traceability: LotTraceability,
): CancelLotEligibility {
  if (lot.cancelledAt) return { allowed: false, reason: "Lotul este deja anulat." };

  if (
    lot.provenance === "return" ||
    lot.provenance === "aport_client" ||
    lot.clientId !== null ||
    traceability.producedBy !== null
  ) {
    return {
      allowed: false,
      reason:
        "Lotul a fost creat de un proces, un retur sau un aport - corectează fluxul respectiv, nu lotul.",
    };
  }

  if (
    lot.remainingQty !== lot.initialQty ||
    traceability.consumedBy.length > 0 ||
    eventTypes.some((type) => !NEUTRAL_EVENTS.includes(type))
  ) {
    return {
      allowed: false,
      reason: "Din acest lot s-a consumat deja - nu mai poate fi anulat.",
    };
  }

  return { allowed: true, reason: null };
}
