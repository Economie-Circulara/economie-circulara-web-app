"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { DIRECTION_OPTIONS } from "./labels";
import {
  addOrUpdateComponent,
  createRecipe,
  removeComponent,
  updateRecipeDirection,
} from "./service";
import type { RecipeDirection } from "./types";
import type { RecipeFormState } from "./action-state";

function clean(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

function parseNumber(value: FormDataEntryValue | null): number | null {
  const s = clean(value);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

const parsePercentage = parseNumber;

function parseDirection(value: FormDataEntryValue | null): RecipeDirection | null {
  const s = clean(value);
  return (DIRECTION_OPTIONS as string[]).includes(s ?? "") ? (s as RecipeDirection) : null;
}

/** Creeaza rețeta (goala) unui item fizic si redirectioneaza la editor. */
export async function createRecipeAction(
  _prev: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  await requireRole(["admin", "operator"]);

  const itemId = clean(formData.get("item_id"));
  if (!itemId) return { error: "Alege un material." };

  const direction = parseDirection(formData.get("direction"));
  if (!direction) return { error: "Alege direcția rețetei (compunere sau descompunere)." };

  let recipe: { id: string; itemId: string };
  try {
    recipe = await createRecipe(itemId, direction);
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
  // Camp optional in formular: gol => 1 (UM-uri identice / fara conversie).
  const rawConversion = clean(formData.get("conversion_factor"));
  const conversionFactor = rawConversion === null ? 1 : parseNumber(rawConversion);

  if (!recipeId || !itemId) return { error: "Rețetă invalidă." };
  if (!componentItemId) return { error: "Alege o componentă." };
  if (percentage === null) return { error: "Introdu un procent valid." };
  if (conversionFactor === null) return { error: "Introdu un factor de conversie valid." };

  try {
    await addOrUpdateComponent({ recipeId, componentItemId, percentage, conversionFactor });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut salva componenta." };
  }

  revalidatePath(`/retete/${itemId}`);
  revalidatePath("/retete");
  return { error: null };
}

/**
 * Schimba directia unei retete existente (compunere <-> descompunere). Permisa,
 * dar schimba semantica tuturor componentelor deja definite - UI-ul cere o
 * confirmare explicita inainte de submit (recipe-editor.tsx).
 */
export async function updateRecipeDirectionAction(
  _prev: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  await requireRole(["admin", "operator"]);

  const recipeId = clean(formData.get("recipe_id"));
  const itemId = clean(formData.get("item_id"));
  const direction = parseDirection(formData.get("direction"));

  if (!recipeId || !itemId) return { error: "Rețetă invalidă." };
  if (!direction) return { error: "Alege direcția rețetei (compunere sau descompunere)." };

  try {
    await updateRecipeDirection(recipeId, direction);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Nu am putut schimba direcția rețetei.",
    };
  }

  revalidatePath(`/retete/${itemId}`);
  revalidatePath("/retete");
  revalidatePath("/productie/nou");
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
