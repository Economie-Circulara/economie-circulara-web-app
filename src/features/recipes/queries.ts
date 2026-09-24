import { createClient } from "@/lib/supabase/server";
import { listItemOptions } from "@/features/items/queries";
import type { RecipeComponent, RecipeDetail, RecipeItemOption, RecipeListRow } from "./types";

/**
 * Lista retetelor cu agregate (nr. componente + suma procentelor). Ecranul /retete.
 * Doua interogari simple + agregare in JS (evita embed-uri imbricate pe 2 nivele,
 * nefolosite inca in alta parte a codebase-ului - pattern consistent cu
 * `src/features/items/queries.ts#listItems`, care agrega la fel `hasRecipe`).
 */
export interface ListRecipesFilters {
  /**
   * Include si retetele arhivate (comutatorul "Arată arhivate" de pe /retete).
   * Implicit `false` - productia si selecturile vad doar retetele active.
   */
  includeArchived?: boolean;
}

/**
 * Momentul arhivarii "efective" a unei retete (migrarea 0035): reteta insasi SAU
 * itemul ei arhivat - in ambele cazuri reteta nu mai poate fi folosita in productie.
 */
export function effectiveRecipeArchivedAt(
  recipeArchivedAt: string | null | undefined,
  itemArchivedAt: string | null | undefined,
): string | null {
  return recipeArchivedAt ?? itemArchivedAt ?? null;
}

export async function listRecipes(filters: ListRecipesFilters = {}): Promise<RecipeListRow[]> {
  const supabase = await createClient();

  const { data: recipeRows, error: recipeError } = await supabase
    .from("recipes")
    .select("id, item_id, direction, archived_at, items(title, unit, archived_at)")
    .order("created_at", { ascending: false });
  if (recipeError) throw new Error("Nu am putut incarca lista de retete.");

  const { data: componentRows, error: componentError } = await supabase
    .from("recipe_components")
    .select("recipe_id, percentage");
  if (componentError) throw new Error("Nu am putut incarca componentele retetelor.");

  const aggregates = new Map<string, { count: number; sum: number }>();
  for (const row of componentRows ?? []) {
    const current = aggregates.get(row.recipe_id) ?? { count: 0, sum: 0 };
    current.count += 1;
    current.sum += Number(row.percentage);
    aggregates.set(row.recipe_id, current);
  }

  const rows = (recipeRows ?? []).map((row) => {
    const agg = aggregates.get(row.id) ?? { count: 0, sum: 0 };
    return {
      recipeId: row.id,
      itemId: row.item_id,
      itemTitle: row.items?.title ?? "-",
      unit: row.items?.unit ?? "kg",
      direction: row.direction ?? "compunere",
      componentCount: agg.count,
      percentageSum: agg.sum,
      archivedAt: effectiveRecipeArchivedAt(row.archived_at, row.items?.archived_at),
    };
  });

  return filters.includeArchived ? rows : rows.filter((row) => row.archivedAt === null);
}

/** Rețeta unui item (cu componente), sau `null` daca itemul nu are inca o reteta. */
export async function getRecipeByItemId(itemId: string): Promise<RecipeDetail | null> {
  const supabase = await createClient();

  const { data: recipe, error: recipeError } = await supabase
    .from("recipes")
    .select("id, item_id, direction, archived_at, items(title, unit, archived_at)")
    .eq("item_id", itemId)
    .maybeSingle();
  if (recipeError) throw new Error("Nu am putut incarca rețeta.");
  if (!recipe) return null;

  const { data: componentRows, error: componentError } = await supabase
    .from("recipe_components")
    .select("id, component_item_id, percentage, conversion_factor, items(title, unit, is_tracked)")
    .eq("recipe_id", recipe.id)
    .order("percentage", { ascending: false });
  if (componentError) throw new Error("Nu am putut incarca componentele rețetei.");

  const components: RecipeComponent[] = (componentRows ?? []).map((row) => ({
    id: row.id,
    componentItemId: row.component_item_id,
    componentItemTitle: row.items?.title ?? "-",
    unit: row.items?.unit ?? "kg",
    percentage: Number(row.percentage),
    // `?? 1` acopera si randurile vechi (coloana are default 1 in DB - migrarea 0028)
    // si testele care nu o includ in fixture.
    conversionFactor: Number(row.conversion_factor ?? 1),
    isTracked: row.items?.is_tracked ?? true,
  }));

  return {
    recipeId: recipe.id,
    itemId: recipe.item_id,
    itemTitle: recipe.items?.title ?? "-",
    unit: recipe.items?.unit ?? "kg",
    direction: recipe.direction ?? "compunere",
    archivedAt: effectiveRecipeArchivedAt(recipe.archived_at, recipe.items?.archived_at),
    recipeArchivedAt: recipe.archived_at ?? null,
    components,
    percentageSum: components.reduce((sum, c) => sum + c.percentage, 0),
  };
}

/** Itemi fizici fara rețetă inca - pentru selectul din /retete/nou. */
export async function listPhysicalItemsWithoutRecipe(): Promise<RecipeItemOption[]> {
  const supabase = await createClient();

  const [items, { data: recipeRows, error }] = await Promise.all([
    listItemOptions({ kind: "physical" }),
    supabase.from("recipes").select("item_id"),
  ]);
  if (error) throw new Error("Nu am putut verifica retetele existente.");

  const withRecipe = new Set((recipeRows ?? []).map((row) => row.item_id));
  return items
    .filter((item) => !withRecipe.has(item.id))
    .map((item) => ({ id: item.id, title: item.title, unit: item.unit }));
}
