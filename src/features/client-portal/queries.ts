import { createClient } from "@/lib/supabase/server";
import type { CatalogItem, ClientOrderDelivery, ItemKind } from "./types";

function mapCatalogItem(row: {
  id: string;
  title: string;
  description: string | null;
  unit: CatalogItem["unit"];
  kind: ItemKind;
  image_url: string | null;
}): CatalogItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    unit: row.unit,
    kind: row.kind,
    imageUrl: row.image_url,
  };
}

export interface ListCatalogItemsFilters {
  kind?: ItemKind;
  /** Cautare (case-insensitive, substring) dupa titlu. */
  search?: string;
}

/**
 * Catalogul clientului (ecranul /catalog): itemi `sellable=true` din organizatia
 * lui, FARA pret/stoc. Interogare proprie (nu `items/queries.ts#listItems`, care
 * mai face un query pe `recipes` - informatie de proces, nu vizibila clientului
 * per AGENTS.md §4; si nu `orders/queries.ts#listSellableItemOptions`, care nu
 * selecteaza `description`/`image_url`, necesare cardurilor din catalog).
 * Filtrul `sellable=true` e defensiv - RLS `items_client_catalog` din
 * 0001_core_schema.sql restrictioneaza oricum randurile vizibile clientului.
 */
export async function listCatalogItems(
  filters: ListCatalogItemsFilters = {},
): Promise<CatalogItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("items")
    .select("id, title, description, unit, kind, image_url")
    .eq("sellable", true)
    // Itemii arhivati (migrarea 0035) nu mai apar in catalog.
    .is("archived_at", null)
    .order("title");

  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.search) query = query.ilike("title", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw new Error("Nu am putut încărca catalogul.");

  return (data ?? []).map(mapCatalogItem);
}

/**
 * Livrarea planificata a unei comenzi proprii (ecranul /comenzile-mele/[id]).
 * `deliveries` e RLS doar-staff, deci trece prin RPC-ul `client_order_delivery`
 * (0041), care verifica proprietatea comenzii si intoarce doar campurile sigure.
 * `null` = comanda nu are (inca) o livrare activa.
 */
export async function getClientOrderDelivery(orderId: string): Promise<ClientOrderDelivery | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_order_delivery", { p_order_id: orderId });
  if (error) throw new Error("Nu am putut încărca detaliile livrării.");

  const row = data?.[0];
  if (!row) return null;
  return {
    scheduledDate: row.scheduled_date,
    carrierName: row.carrier_name,
    vehiclePlate: row.vehicle_plate,
    driverName: row.driver_name,
    destination: row.route_destination,
    uitCode: row.uit_code,
    receivedAt: row.received_at,
    receivedByName: row.received_by_name,
  };
}
