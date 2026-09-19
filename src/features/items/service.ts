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
    isTracked: row.is_tracked,
    sellable: row.sellable,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface CreateItemInput {
  /**
   * Id pre-generat (vezi `randomUUID()` in actions.ts) - permite incarcarea pozei
   * in storage la path-ul `${id}/image` INAINTE de a insera itemul, ca eventuala
   * eroare de upload sa nu lase in urma un item orfan fara poza.
   */
  id?: string;
  organizationId: string;
  title: string;
  description?: string | null;
  unit: UnitOfMeasure;
  kind: ItemKind;
  /**
   * `items.is_tracked` (migrarea 0029) - `false` doar pentru itemi fizici
   * "nelimitati" (apa, aer): raman in catalog si in retete, dar sunt sariti de la
   * consumul de stoc. Implicit `true`.
   */
  isTracked?: boolean;
  sellable: boolean;
  imageUrl?: string | null;
}

/** Creeaza un item nou in catalog (organizatia curenta a apelantului). */
export async function createItem(input: CreateItemInput): Promise<Item> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      organization_id: input.organizationId,
      title: input.title,
      description: input.description ?? null,
      unit: input.unit,
      kind: input.kind,
      is_tracked: input.isTracked ?? true,
      sellable: input.sellable,
      image_url: input.imageUrl ?? null,
    })
    .select(
      "id, organization_id, title, description, unit, kind, is_tracked, sellable, image_url, created_at, updated_at",
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
  /** Vezi `CreateItemInput.isTracked`. Implicit `true`. */
  isTracked?: boolean;
  sellable: boolean;
  /**
   * Tri-state: cheia LIPSA = nu atinge poza existenta (nu s-a incarcat un fisier
   * nou si nu s-a cerut eliminarea); `null` = elimina poza; `string` = poza noua.
   * Verificat prin `"imageUrl" in input`, nu prin `??`, ca sa distingem "lipsa" de
   * "explicit null" - vezi actions.ts.
   */
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
      is_tracked: input.isTracked ?? true,
      sellable: input.sellable,
      ...("imageUrl" in input ? { image_url: input.imageUrl ?? null } : {}),
    })
    .eq("id", id)
    .select(
      "id, organization_id, title, description, unit, kind, is_tracked, sellable, image_url, created_at, updated_at",
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Nu am putut salva itemul (verifica accesul).");
  }
  return mapItem(data);
}
