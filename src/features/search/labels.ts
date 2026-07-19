import type { SearchResultType } from "./types";

/** Eticheta RO a grupului de rezultate, pentru fiecare tip de entitate. */
export const SEARCH_GROUP_LABELS: Record<SearchResultType, string> = {
  order: "Comenzi",
  client: "Clienți",
  lot: "Loturi",
  item: "Produse",
  certificate: "Certificate",
};

/**
 * Ordinea canonica de afisare a grupurilor (cerinta X2: "comanda/client/lot/
 * produs/certificat"). Grupurile fara rezultate sunt omise la afisare.
 */
export const SEARCH_GROUP_ORDER: SearchResultType[] = [
  "order",
  "client",
  "lot",
  "item",
  "certificate",
];
