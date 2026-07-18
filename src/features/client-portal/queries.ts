import { createClient } from "@/lib/supabase/server";
import type { CatalogItem, ItemKind } from "./types";

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
 * mai face un query pe `recipes` — informatie de proces, nu vizibila clientului
 * per AGENTS.md §4; si nu `orders/queries.ts#listSellableItemOptions`, care nu
 * selecteaza `description`/`image_url`, necesare cardurilor din catalog).
 * Filtrul `sellable=true` e defensiv — RLS `items_client_catalog` din
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
    .order("title");

  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.search) query = query.ilike("title", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw new Error("Nu am putut încărca catalogul.");

  return (data ?? []).map(mapCatalogItem);
}
