"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { addOrUpdateComponent, createRecipe, removeComponent } from "./service";

export interface RecipeFormState {
  error: string | null;
}

export const initialRecipeFormState: RecipeFormState = { error: null };

function clean(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

function parsePercentage(value: FormDataEntryValue | null): number | null {
  const s = clean(value);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Creeaza rețeta (goala) unui item fizic si redirectioneaza la editor. */
export async function createRecipeAction(
  _prev: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  await requireRole(["admin", "operator"]);

  const itemId = clean(formData.get("item_id"));
  if (!itemId) return { error: "Alege un item." };

  let recipe: { id: string; itemId: string };
  try {
    recipe = await createRecipe(itemId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut crea rețeta." };
  }

  revalidatePath("/retete");
  redirect(`/retete/${recipe.itemId}`);
}

/** Adauga/actualizeaza o componenta a rețetei (formularul din editor). */
export async function addComponentAction(
  _prev: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  await requireRole(["admin", "operator"]);

  const recipeId = clean(formData.get("recipe_id"));
  const itemId = clean(formData.get("item_id")); // itemul-tinta al rețetei (pentru revalidare)
  const componentItemId = clean(formData.get("component_item_id"));
  const percentage = parsePercentage(formData.get("percentage"));

  if (!recipeId || !itemId) return { error: "Rețetă invalidă." };
  if (!componentItemId) return { error: "Alege o componentă." };
  if (percentage === null) return { error: "Introdu un procent valid." };

  try {
    await addOrUpdateComponent({ recipeId, componentItemId, percentage });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut salva componenta." };
  }

  revalidatePath(`/retete/${itemId}`);
  revalidatePath("/retete");
  return { error: null };
}

/** Șterge o componenta a rețetei. */
export async function removeComponentAction(
  _prev: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  await requireRole(["admin", "operator"]);

  const componentId = clean(formData.get("component_id"));
  const itemId = clean(formData.get("item_id"));
  if (!componentId) return { error: "Componentă invalidă." };

  try {
    await removeComponent(componentId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut șterge componenta." };
  }

  if (itemId) revalidatePath(`/retete/${itemId}`);
  revalidatePath("/retete");
  return { error: null };
}
