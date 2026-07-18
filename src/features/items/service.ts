import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { Item, ItemKind, UnitOfMeasure } from "./types";

type ItemRow = Database["public"]["Tables"]["items"]["Row"];

function mapItem(row: ItemRow): Item {
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

export interface CreateItemInput {
  organizationId: string;
  title: string;
  description?: string | null;
  unit: UnitOfMeasure;
  kind: ItemKind;
  sellable: boolean;
  imageUrl?: string | null;
}

/** Creeaza un item nou in catalog (organizatia curenta a apelantului). */
export async function createItem(input: CreateItemInput): Promise<Item> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .insert({
      organization_id: input.organizationId,
      title: input.title,
      description: input.description ?? null,
      unit: input.unit,
      kind: input.kind,
      sellable: input.sellable,
      image_url: input.imageUrl ?? null,
    })
    .select(
      "id, organization_id, title, description, unit, kind, sellable, image_url, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Nu am putut crea itemul.");
  }
  return mapItem(data);
}

export interface UpdateItemInput {
  title: string;
  description?: string | null;
  unit: UnitOfMeasure;
  kind: ItemKind;
  sellable: boolean;
  imageUrl?: string | null;
}

/** Actualizeaza un item existent (RLS filtreaza in afara organizatiei apelantului). */
export async function updateItem(id: string, input: UpdateItemInput): Promise<Item> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .update({
      title: input.title,
      description: input.description ?? null,
      unit: input.unit,
      kind: input.kind,
      sellable: input.sellable,
      image_url: input.imageUrl ?? null,
    })
    .eq("id", id)
    .select(
      "id, organization_id, title, description, unit, kind, sellable, image_url, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Nu am putut salva itemul (verifica accesul).");
  }
  return mapItem(data);
}
