import { createClient } from "@/lib/supabase/server";
import {
  validateConversionFactor,
  validateNotSelfReference,
  validatePercentage,
} from "./validation";
import type { RecipeDirection } from "./types";

export interface CreatedRecipe {
  id: string;
  itemId: string;
}

/**
 * Creeaza rețeta (goala) unui item - doar pentru itemi de tip `physical`
 * (retetele nu au sens pentru servicii/abonamente PaaS, vezi migrarea 0005).
 * O singura rețetă per item (constraint `unique(item_id)` din 0001).
 *
 * `direction` (migrarea 0028) se alege EXPLICIT la creare: `compunere` = itemul e
 * outputul si componentele sunt inputurile consumate; `descompunere` = itemul e
 * inputul si componentele sunt fractiile rezultate (reciclare). Inainte, directia
 * era dedusa din wizard-ul folosit, ceea ce inversa fluxurile.
 */
export async function createRecipe(
  itemId: string,
  direction: RecipeDirection = "compunere",
): Promise<CreatedRecipe> {
  const supabase = await createClient();

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, organization_id, kind")
    .eq("id", itemId)
    .maybeSingle();
  if (itemError || !item) throw new Error("Material inexistent sau fără acces.");
  if (item.kind !== "physical") {
    throw new Error("Rețetele se pot defini doar pentru materiale de tip fizic.");
  }

  const { data, error } = await supabase
    .from("recipes")
    .insert({ organization_id: item.organization_id, item_id: item.id, direction })
    .select("id, item_id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Nu am putut crea rețeta.");
  }
  return { id: data.id, itemId: data.item_id };
}

/**
 * Schimba directia unei retete existente. Permisa (retetele nu au versionare -
 * AGENTS.md §4), dar schimba semantica TUTUROR componentelor deja definite, asa ca
 * UI-ul avertizeaza inainte de salvare (vezi recipe-editor.tsx).
 */
export async function updateRecipeDirection(
  recipeId: string,
  direction: RecipeDirection,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("recipes").update({ direction }).eq("id", recipeId);
  if (error) throw new Error(error.message ?? "Nu am putut schimba direcția rețetei.");
}

export interface AddComponentInput {
  recipeId: string;
  componentItemId: string;
  percentage: number;
  /**
   * Cate unitati din UM-ul itemului retetei corespund unei unitati din UM-ul
   * componentei (migrarea 0028). Implicit 1 - no-op cand UM-urile coincid.
   */
  conversionFactor?: number;
}

/**
 * Adauga o componenta a rețetei (sau actualizeaza procentul/factorul, daca acel
 * item e deja componenta - `unique(recipe_id, component_item_id)` din 0001, folosit
 * ca upsert). Valideaza procentul, factorul de conversie si non-auto-referinta fata
 * de itemul propriu al rețetei - itemul rețetei se preia din DB (nu din input
 * extern), la fel ca in `src/features/stock/service.ts#recordStockEvent`.
 */
export async function addOrUpdateComponent(input: AddComponentInput): Promise<void> {
  const percentageError = validatePercentage(input.percentage);
  if (percentageError) throw new Error(percentageError);

  const conversionFactor = input.conversionFactor ?? 1;
  const conversionError = validateConversionFactor(conversionFactor);
  if (conversionError) throw new Error(conversionError);

  const supabase = await createClient();

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id, item_id, organization_id")
    .eq("id", input.recipeId)
    .maybeSingle();
  if (recipeError || !recipe) throw new Error("Rețetă inexistentă sau fără acces.");

  const selfRefError = validateNotSelfReference(recipe.item_id, input.componentItemId);
  if (selfRefError) throw new Error(selfRefError);

  const { error } = await supabase.from("recipe_components").upsert(
    {
      organization_id: recipe.organization_id,
      recipe_id: recipe.id,
      component_item_id: input.componentItemId,
      percentage: input.percentage,
      conversion_factor: conversionFactor,
    },
    { onConflict: "recipe_id,component_item_id" },
  );

  if (error) throw new Error(error.message ?? "Nu am putut salva componenta.");
}

/** Șterge o componenta a rețetei. */
export async function removeComponent(componentId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("recipe_components").delete().eq("id", componentId);
  if (error) throw new Error(error.message ?? "Nu am putut șterge componenta.");
}

/**
 * Arhiveaza (`archive = true`) sau restaureaza o reteta intreaga (migrarea 0035).
 * O reteta arhivata ramane legata de procesele vechi (trasabilitate), dar nu mai
 * poate porni procese noi (garda DB `AR002` + filtrul din productie).
 */
export async function setRecipeArchived(recipeId: string, archive: boolean): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recipes")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq("id", recipeId)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message ?? "Nu am putut actualiza rețeta.");
  if (!data) throw new Error("Rețeta nu există sau nu ai acces la ea.");
}
