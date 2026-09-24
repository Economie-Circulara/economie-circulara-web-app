import type { OrderStatus, OrderType } from "./types";

/** Etichete RO pentru tipul comenzii (enum DB `order_type`, migrarea 0030). */
export const ORDER_TYPE_LABELS: Record<OrderType, string> = {
  material: "Material",
  serviciu: "Abonament",
  aport: "Aport",
};

/**
 * Explicatia fiecarui tip, aratata langa selector la creare - tipul nu poate fi
 * ghicit din denumire (mai ales "aport", care inverseaza sensul stocului).
 * Eticheta enum-ului DB `serviciu` e "Abonament" in UI - valoarea enum nu se
 * schimba (cost de migrare), doar denumirea afisata (regula de naming din
 * AGENTS.md, task Abonamente).
 */
export const ORDER_TYPE_DESCRIPTIONS: Record<OrderType, string> = {
  material: "Vânzare de produse fizice către client. Scade stocul la acceptare.",
  serviciu: "Abonament (product-as-a-service), cu dată estimată de retur.",
  aport: "Clientul aduce material către organizație (ex. moloz). Crește stocul la acceptare.",
};

export const ORDER_TYPE_OPTIONS: OrderType[] = ["material", "serviciu", "aport"];

/** Etichete RO pentru statusul unei comenzi (folosite in select-uri de filtrare). */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Ciornă",
  sent: "Înaintată",
  accepted: "Confirmată",
  delivered: "Livrată",
  closed: "Finalizată",
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
 * din mockup (romana) si nu poate fi modificat din acest task (fisier partajat) -
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
