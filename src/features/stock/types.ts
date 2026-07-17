import type { Database } from "@/lib/database.types";

export type LotProvenance = Database["public"]["Enums"]["lot_provenance"];
export type QualityStatus = Database["public"]["Enums"]["quality_status"];
export type StockEventType = Database["public"]["Enums"]["stock_event_type"];
export type UnitOfMeasure = Database["public"]["Enums"]["unit_of_measure"];

/** Un lot, asa cum il returneaza `service.ts` (fara detalii de item — vezi `LotWithItem`). */
export interface Lot {
  id: string;
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
  createdAt: string;
}

/** Lot + titlul/UM al itemului (pentru ecranele de listare). */
export interface LotWithItem extends Lot {
  itemTitle: string;
  unit: UnitOfMeasure;
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
