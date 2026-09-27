import type { Database } from "@/lib/database.types";

export type ItemKind = Database["public"]["Enums"]["item_kind"];
export type UnitOfMeasure = Database["public"]["Enums"]["unit_of_measure"];

/**
 * Un item din catalogul clientului (doar `sellable=true`, FARA pret/stoc - regula
 * de business AGENTS.md §4: clientul nu vede stocul/procesele interne).
 */
export interface CatalogItem {
  id: string;
  title: string;
  description: string | null;
  unit: UnitOfMeasure;
  kind: ItemKind;
  imageUrl: string | null;
}

/** O linie din cosul clientului (client-side, nu persista in DB pana la trimitere). */
export interface CartLine {
  itemId: string;
  itemTitle: string;
  unit: UnitOfMeasure;
  quantity: number;
}

/**
 * Livrarea (activa) a unei comenzi proprii, asa cum o vede clientul - subset sigur
 * din `deliveries`, intors de RPC-ul `client_order_delivery` (migrarea 0041).
 */
export interface ClientOrderDelivery {
  scheduledDate: string;
  carrierName: string;
  vehiclePlate: string;
  driverName: string;
  destination: string;
  uitCode: string | null;
  receivedAt: string | null;
  receivedByName: string | null;
}
