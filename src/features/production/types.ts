import type { Database } from "@/lib/database.types";

export type ProcessType = Database["public"]["Enums"]["process_type"];
export type ProcessStatus = Database["public"]["Enums"]["process_status"];
export type LotProvenance = Database["public"]["Enums"]["lot_provenance"];
export type UnitOfMeasure = Database["public"]["Enums"]["unit_of_measure"];
export type QualityStatus = Database["public"]["Enums"]["quality_status"];

/**
 * "Tip proces" ales de utilizator in wizard — orthogonal fata de `ProcessType`
 * (care descrie DOAR modul de calcul: output fix / input fix). Seteaza
 * provenienta loturilor de output create la confirmare (vezi migrarea 0008 si
 * AGENTS.md §4: recondiționarea trebuie sa apara distinct de reciclare).
 */
export type ProductionKind = "productie" | "reciclare" | "reconditionare";

export const PRODUCTION_KIND_TO_PROVENANCE: Record<ProductionKind, LotProvenance> = {
  productie: "internal_production",
  reciclare: "recycling",
  reconditionare: "reconditioning",
};

/** Rand din istoricul de procese — ecranul /productie. */
export interface ProcessListRow {
  id: string;
  type: ProcessType;
  status: ProcessStatus;
  outputItemId: string | null;
  outputItemTitle: string;
  recipeId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

/** O linie de input/output in detaliul unui proces (pt. tabel + Sankey). */
export interface ProcessLotLine {
  lotId: string;
  itemId: string;
  itemTitle: string;
  unit: UnitOfMeasure;
  quantity: number;
  /** Doar pt. outputuri: proveniența lotului nou creat. */
  provenance?: LotProvenance;
}

/** Detaliul complet al unui proces — ecranul /productie/[id]. */
export interface ProcessDetail {
  id: string;
  type: ProcessType;
  status: ProcessStatus;
  outputItemId: string | null;
  outputItemTitle: string;
  recipeId: string | null;
  notes: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  inputs: ProcessLotLine[];
  outputs: ProcessLotLine[];
  /** Suma cantitati input - suma cantitati output (randament/pierderi — informativ, nevalidat). */
  totalInputQty: number;
  totalOutputQty: number;
}

// -----------------------------------------------------------------------------
// Payload-ul trimis catre RPC-ul `confirm_process` (migrarea 0008) — vezi
// src/features/production/service.ts#confirmProcess.
// -----------------------------------------------------------------------------
export interface ConfirmProcessInputLine {
  itemId: string;
  /** Loturile alese la preview (FIFO calculat sau selectie manuala), in ordine. */
  lotIds: string[];
  qty: number;
}

export interface ConfirmProcessOutputLine {
  itemId: string;
  qty: number;
  provenance: LotProvenance;
  source?: string | null;
  location?: string | null;
  qualityStatus?: QualityStatus | null;
}

export interface ConfirmProcessInput {
  type: ProcessType;
  outputItemId: string;
  recipeId?: string | null;
  notes?: string | null;
  inputs: ConfirmProcessInputLine[];
  outputs: ConfirmProcessOutputLine[];
}
