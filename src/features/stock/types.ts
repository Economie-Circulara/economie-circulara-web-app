import type { Database } from "@/lib/database.types";
import type { ProcessStatus, ProcessType } from "@/features/production/types";

export type LotProvenance = Database["public"]["Enums"]["lot_provenance"];
export type QualityStatus = Database["public"]["Enums"]["quality_status"];
export type StockEventType = Database["public"]["Enums"]["stock_event_type"];
export type UnitOfMeasure = Database["public"]["Enums"]["unit_of_measure"];

/** Un lot, asa cum il returneaza `service.ts` (fara detalii de item - vezi `LotWithItem`). */
export interface Lot {
  id: string;
  /** Cod uman de identificare (format "LOT-<an>-<secventa>", migrarea 0033). */
  lotCode: string;
  itemId: string;
  entryDate: string;
  source: string | null;
  provenance: LotProvenance;
  location: string | null;
  initialQty: number;
  remainingQty: number;
  qualityStatus: QualityStatus;
  isBlocked: boolean;
  blockReason: string | null;
  /**
   * Clientul care a adus materialul - completat DOAR pe loturile venite dintr-un
   * aport (`provenance = 'aport_client'`, migrarile 0030/0031), null in rest.
   */
  clientId: string | null;
  createdAt: string;
}

/** Lot + titlul/UM al itemului (pentru ecranele de listare). */
export interface LotWithItem extends Lot {
  itemTitle: string;
  unit: UnitOfMeasure;
  /** Denumirea clientului din `clientId` (aport), altfel null. */
  clientName: string | null;
}

/** Un item, pe cat e nevoie in formularele de stoc (select). */
export interface ItemOption {
  id: string;
  title: string;
  unit: UnitOfMeasure;
}

/** Un rand din `stock_events`, cu detalii de afisare (item, cine). */
export interface StockEvent {
  id: string;
  itemId: string;
  itemTitle: string;
  lotId: string | null;
  eventType: StockEventType;
  quantity: number;
  reason: string | null;
  orderId: string | null;
  processId: string | null;
  createdBy: string | null;
  createdByName: string | null;
  createdAt: string;
}

/**
 * Legatura dintre un lot si un proces de productie/reciclare (trasabilitate pe un
 * singur hop - vezi `getLotTraceability` in queries.ts). Nu duplica graful complet
 * din `src/features/certificates/traceability.ts` (acela porneste de la loturile
 * livrate pe o comanda si e specific certificatelor) - doar leaga lotul de
 * procesul imediat anterior/urmator, cu link catre ecranul `/productie/[id]`
 * pentru graful Sankey al ACELUI proces, daca utilizatorul vrea sa mearga mai departe.
 */
export interface LotProcessLink {
  processId: string;
  type: ProcessType;
  status: ProcessStatus;
  quantity: number;
  createdAt: string;
}

/** Trasabilitate pe un singur lot: procesul care l-a produs + procesele care l-au consumat. */
export interface LotTraceability {
  producedBy: LotProcessLink | null;
  consumedBy: LotProcessLink[];
}
