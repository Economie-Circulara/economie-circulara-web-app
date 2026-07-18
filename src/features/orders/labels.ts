import type { OrderStatus } from "./types";

/** Etichete RO pentru statusul unei comenzi (folosite in select-uri de filtrare). */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  sent: "Trimisă",
  accepted: "Acceptată",
  delivered: "Livrată",
  closed: "Închisă",
  cancelled: "Anulată",
};

export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  "draft",
  "sent",
  "accepted",
  "delivered",
  "closed",
  "cancelled",
];

/**
 * Cheia din `STATUS_REGISTRY.order` (src/components/status-badge.tsx) pentru fiecare
 * valoare din enum-ul DB `order_status`. Registrul de statusuri e definit cu chei
 * din mockup (romana) si nu poate fi modificat din acest task (fisier partajat) —
 * toate cele 6 statusuri de comanda au deja o cheie acolo, doar denumite diferit
 * fata de enum (`sent` -> `trimisa`, `accepted` -> `acceptata` etc.), acelasi
 * pattern ca `PROVENANCE_BADGE_STATUS` in src/features/stock/labels.ts.
 */
export const ORDER_STATUS_BADGE_STATUS: Record<OrderStatus, string> = {
  draft: "draft",
  sent: "trimisa",
  accepted: "acceptata",
  delivered: "livrata",
  closed: "inchisa",
  cancelled: "anulata",
};
