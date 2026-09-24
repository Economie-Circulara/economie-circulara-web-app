import type { DeliveryRecord } from "./types";

/**
 * O livrare a "plecat" (migrarea 0035) cand e declarata la RO e-Transport (are cod
 * UIT - transportul e legal pe drum) sau cand receptia a fost deja confirmata.
 * `deliveries` nu are o coloana de status proprie; acestea sunt singurele repere.
 */
export function hasDeliveryDeparted(
  delivery: Pick<DeliveryRecord, "declarationStatus" | "uitCode" | "receipt">,
): boolean {
  return (
    delivery.declarationStatus === "declared" ||
    delivery.uitCode !== null ||
    delivery.receipt.receivedAt !== null
  );
}

/**
 * Regula PURA "se poate anula livrarea?" - oglinda verificarii din RPC-ul
 * `cancel_delivery` (sursa de adevar): doar INAINTE de plecare. Dupa plecare,
 * livrarea ramane (e parte din trasabilitate); comanda se gestioneaza din fluxul ei.
 */
export function canCancelDelivery(
  delivery: Pick<DeliveryRecord, "declarationStatus" | "uitCode" | "receipt">,
): boolean {
  return !hasDeliveryDeparted(delivery);
}
