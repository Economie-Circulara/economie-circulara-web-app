import { createClient } from "@/lib/supabase/server";
import type { Item, ItemKind, ItemListRow, ItemOption } from "./types";

function mapItem(row: {
  id: string;
  title: string;
  description: string | null;
  unit: Item["unit"];
  kind: ItemKind;
  sellable: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}): Item {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    unit: row.unit,
    kind: row.kind,
    sellable: row.sellable,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ListItemsFilters {
  kind?: ItemKind;
  sellable?: boolean;
  /** Cautare (case-insensitive, substring) dupa titlu. */
  search?: string;
}

/** Lista itemilor organizatiei curente (RLS), cu filtre + flag "are reteta". Ecranul /itemi. */
export async function listItems(filters: ListItemsFilters = {}): Promise<ItemListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("items")
    .select("id, title, description, unit, kind, sellable, image_url, created_at, updated_at")
    .order("title");

  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.sellable !== undefined) query = query.eq("sellable", filters.sellable);
  if (filters.search) query = query.ilike("title", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw new Error("Nu am putut incarca lista de itemi.");

  const { data: recipeRows, error: recipeError } = await supabase.from("recipes").select("item_id");
  if (recipeError) throw new Error("Nu am putut verifica retetele existente.");

  const itemsWithRecipe = new Set((recipeRows ?? []).map((row) => row.item_id));

  return (data ?? []).map((row) => ({
    ...mapItem(row),
    hasRecipe: itemsWithRecipe.has(row.id),
  }));
}

/** Un item dupa id, sau `null` daca nu exista/nu e accesibil (RLS). Ecranul /itemi/[id]. */
export async function getItemById(id: string): Promise<Item | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .select("id, title, description, unit, kind, sellable, image_url, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Nu am putut incarca itemul.");
  return data ? mapItem(data) : null;
}

export interface ListItemOptionsFilters {
  kind?: ItemKind;
  /** Exclude un item din lista (ex. itemul propriu, in editorul de retete). */
  excludeId?: string;
}

/** Optiuni de item pentru select-uri (stoc, componente de reteta). */
export async function listItemOptions(filters: ListItemOptionsFilters = {}): Promise<ItemOption[]> {
  const supabase = await createClient();
  let query = supabase.from("items").select("id, title, unit, kind").order("title");

  if (filters.kind) query = query.eq("kind", filters.kind);
  if (filters.excludeId) query = query.neq("id", filters.excludeId);

  const { data, error } = await query;
  if (error) throw new Error("Nu am putut incarca lista de itemi.");

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    unit: row.unit,
    kind: row.kind,
  }));
}
