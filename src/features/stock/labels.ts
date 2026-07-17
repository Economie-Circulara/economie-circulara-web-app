import type { LotProvenance, QualityStatus, StockEventType } from "./types";

/** Etichete RO pentru proveniența unui lot (folosite in formular + tabele). */
export const PROVENANCE_LABELS: Record<LotProvenance, string> = {
  purchase: "Achiziție",
  internal_production: "Producție internă",
  recycling: "Reciclare",
  return: "Retur",
  inventory_adjustment: "Ajustare inventar",
};

export const PROVENANCE_OPTIONS: LotProvenance[] = [
  "purchase",
  "internal_production",
  "recycling",
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
  return: "retur",
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
