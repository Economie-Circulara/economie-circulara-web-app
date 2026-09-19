import type { LotProvenance, QualityStatus, StockEventType } from "./types";

/** Etichete RO pentru proveniența unui lot (folosite in formular + tabele). */
export const PROVENANCE_LABELS: Record<LotProvenance, string> = {
  purchase: "Achiziție",
  internal_production: "Producție internă",
  recycling: "Reciclare",
  // Task D: recondiționare - distincta de reciclare (Anexa 1 d).
  reconditioning: "Recondiționare",
  return: "Retur",
  // Migrarea 0030: material adus de client printr-o comanda de tip `aport`.
  aport_client: "Aport client",
  inventory_adjustment: "Ajustare inventar",
};

/**
 * Provenientele alegibile MANUAL in formularul de adaugare lot. `aport_client`
 * lipseste INTENTIONAT: un lot de aport se creeaza doar prin `accept_intake_order`
 * (migrarea 0031), care completeaza si `lots.client_id` - ales manual aici, ar
 * produce un lot "de la client" fara sa se stie de la care.
 */
export const PROVENANCE_OPTIONS: LotProvenance[] = [
  "purchase",
  "internal_production",
  "recycling",
  "reconditioning",
  "return",
  "inventory_adjustment",
];

/**
 * Cheia din `STATUS_REGISTRY.provenance` (src/components/status-badge.tsx) pentru
 * fiecare valoare din enum-ul DB `lot_provenance`. Registrul de statusuri e definit
 * cu chei in romana si nu poate fi modificat din acest task (fisier partajat).
 */
export const PROVENANCE_BADGE_STATUS: Record<LotProvenance, string> = {
  purchase: "achizitie",
  internal_production: "productie",
  recycling: "reciclare",
  reconditioning: "reconditionare",
  return: "retur",
  aport_client: "aport",
  inventory_adjustment: "ajustare",
};

export const QUALITY_LABELS: Record<QualityStatus, string> = {
  unchecked: "Neverificat",
  passed: "Admis",
  failed: "Respins",
};

export const STOCK_EVENT_LABELS: Record<StockEventType, string> = {
  intake: "Intrare",
  consumption: "Consum",
  adjustment: "Ajustare",
  block: "Blocare",
  unblock: "Deblocare",
  reversal: "Stornare",
};

/** Cheia din `STATUS_REGISTRY.lot` pentru starea de blocare a unui lot. */
export function lotBadgeStatus(isBlocked: boolean): "activ" | "blocat" {
  return isBlocked ? "blocat" : "activ";
}
