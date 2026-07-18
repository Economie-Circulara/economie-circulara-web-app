import { createClient } from "@/lib/supabase/server";
import { validateNotSelfReference, validatePercentage } from "./validation";

export interface CreatedRecipe {
  id: string;
  itemId: string;
}

/**
 * Creeaza rețeta (goala) unui item — doar pentru itemi de tip `physical`
 * (retetele nu au sens pentru servicii/abonamente PaaS, vezi migrarea 0005).
 * O singura rețeta per item (constraint `unique(item_id)` din 0001).
 */
export async function createRecipe(itemId: string): Promise<CreatedRecipe> {
  const supabase = await createClient();

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("id, organization_id, kind")
    .eq("id", itemId)
    .maybeSingle();
  if (itemError || !item) throw new Error("Item inexistent sau fără acces.");
  if (item.kind !== "physical") {
    throw new Error("Rețetele se pot defini doar pentru itemi de tip fizic.");
  }

  const { data, error } = await supabase
    .from("recipes")
    .insert({ organization_id: item.organization_id, item_id: item.id })
    .select("id, item_id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Nu am putut crea rețeta.");
  }
  return { id: data.id, itemId: data.item_id };
}

export interface AddComponentInput {
  recipeId: string;
  componentItemId: string;
  percentage: number;
}

/**
 * Adauga o componenta a rețetei (sau actualizeaza procentul, daca acel item e deja
 * componenta — `unique(recipe_id, component_item_id)` din 0001, folosit ca upsert).
 * Valideaza procentul si non-auto-referinta fata de itemul propriu al rețetei —
 * itemul rețetei se preia din DB (nu din input extern), la fel ca in
 * `src/features/stock/service.ts#recordStockEvent`.
 */
export async function addOrUpdateComponent(input: AddComponentInput): Promise<void> {
  const percentageError = validatePercentage(input.percentage);
  if (percentageError) throw new Error(percentageError);

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
