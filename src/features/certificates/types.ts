import type { SankeyData } from "@/features/production/sankey-data";
import type { Database } from "@/lib/database.types";

export type LotProvenance = Database["public"]["Enums"]["lot_provenance"];
export type ProcessType = Database["public"]["Enums"]["process_type"];

// -----------------------------------------------------------------------------
// Date brute (fetch dintr-o singura data — vezi repository.ts) consumate de
// `buildTraceabilitySnapshot` (traceability.ts, functie PURA, fara Supabase).
// -----------------------------------------------------------------------------

/** O linie efectiv livrata (consumata din stoc la acceptarea comenzii — `stock_events`). */
export interface DeliveredLotLine {
  lotId: string;
  itemId: string;
  itemTitle: string;
  unit: string;
  /** Cantitate consumata pentru ACEASTA comanda (poate fi < initial_qty a lotului). */
  quantity: number;
}

/** Subsetul de coloane `lots` necesar traversarii graf-ului. */
export interface RawLot {
  id: string;
  itemId: string;
  itemTitle: string;
  unit: string;
  provenance: LotProvenance;
  source: string | null;
  entryDate: string;
}

/** Subsetul de coloane `processes` necesar traversarii graf-ului. */
export interface RawProcess {
  id: string;
  type: ProcessType;
  completedAt: string | null;
}

/** Randul din `process_outputs` care a PRODUS un lot dat (cel mult unul per lot). */
export interface RawProcessOutput {
  processId: string;
  lotId: string;
  /** Cantitatea TOTALA produsa din acest lot de acest proces (nu doar partea consumata). */
  quantity: number;
}

/** Un rand din `process_inputs` — un lot consumat de un proces. */
export interface RawProcessInput {
  processId: string;
  lotId: string;
  quantity: number;
}

/**
 * Setul complet de date brute necesar reconstructiei graf-ului de trasabilitate
 * pentru o comanda — deja fetch-uit din DB (vezi `repository.ts`), fara nicio
 * dependenta ulterioara de retea. Consumat de functia pura `buildTraceabilitySnapshot`.
 */
export interface TraceabilityRawData {
  delivered: DeliveredLotLine[];
  lots: Record<string, RawLot>;
  processes: Record<string, RawProcess>;
  /** Cheie: lot_id produs. */
  outputByLot: Record<string, RawProcessOutput>;
  /** Cheie: process_id. */
  inputsByProcess: Record<string, RawProcessInput[]>;
}

// -----------------------------------------------------------------------------
// Rezultatul constructiei (graf + tabel "Materiale si origine") — forma
// inghetata in `certificates.traceability_snapshot` (jsonb).
// -----------------------------------------------------------------------------

export interface MaterialOriginRow {
  material: string;
  origin: string;
  source: string;
  quantity: number;
  unit: string;
  /** 0-100, rotunjit la o zecimala. */
  percentage: number;
}

export interface TraceabilitySnapshotOrder {
  id: string;
  number: string | null;
  clientName: string;
  clientCui: string;
}

export interface TraceabilitySnapshotItem {
  itemId: string;
  itemTitle: string;
  unit: string;
  quantity: number;
}

/** Versiunea structurii — creste daca forma se schimba, ca sa poata fi migrata la citire. */
export const TRACEABILITY_SNAPSHOT_VERSION = 1 as const;

export interface TraceabilitySnapshot {
  version: typeof TRACEABILITY_SNAPSHOT_VERSION;
  generatedAt: string;
  order: TraceabilitySnapshotOrder;
  deliveredItems: TraceabilitySnapshotItem[];
  graph: SankeyData;
  materials: MaterialOriginRow[];
}

// -----------------------------------------------------------------------------
// Certificatul, asa cum e expus de service.ts.
// -----------------------------------------------------------------------------

export interface CertificateRecord {
  id: string;
  organizationId: string;
  orderId: string;
  number: string;
  issuedAt: string;
  pdfPath: string | null;
  snapshot: TraceabilitySnapshot;
}
