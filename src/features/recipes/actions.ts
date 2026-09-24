"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { DIRECTION_OPTIONS } from "./labels";
import {
  addOrUpdateComponent,
  addOrUpdateComponents,
  createRecipe,
  removeComponent,
  setRecipeArchived,
  updateRecipeDirection,
} from "./service";
import { quantitiesToPercentages } from "./quantity-calc";
import { validateNotSelfReference } from "./validation";
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

interface QuantityRow {
  componentItemId: string;
  quantity: number;
}

function parseQuantityRows(value: FormDataEntryValue | null): QuantityRow[] | null {
  const raw = clean(value);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;

  const rows: QuantityRow[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== "object") return null;
    const componentItemId = (entry as Record<string, unknown>).componentItemId;
    const quantity = (entry as Record<string, unknown>).quantity;
    if (typeof componentItemId !== "string" || !componentItemId) return null;
    if (typeof quantity !== "number" || !Number.isFinite(quantity)) return null;
    rows.push({ componentItemId, quantity });
  }
  return rows;
}

/**
 * Salveaza rețeta din modul de input "Cantități reale" (docs/plans/reteta-vizuala.md):
 * primeste cantitatea de baza + cantitati reale per componenta (aceeasi UM ca
 * rețeta - faza 1, fara conversii), calculeaza procentele (`quantitiesToPercentages`)
 * si le salveaza prin `addOrUpdateComponents` - ACELASI upsert/validare ca modul
 * clasic de procente, doar intrarea difera.
 */
export async function saveQuantityComponentsAction(
  _prev: RecipeFormState,
  formData: FormData,
): Promise<RecipeFormState> {
  await requireRole(["admin", "operator"]);

  const recipeId = clean(formData.get("recipe_id"));
  const itemId = clean(formData.get("item_id"));
  const batchQty = parseNumber(formData.get("batch_qty"));
  const rows = parseQuantityRows(formData.get("rows_json"));

  if (!recipeId || !itemId) return { error: "Rețetă invalidă." };
  if (batchQty === null || batchQty <= 0) {
    return { error: "Introdu o cantitate de bază mai mare ca 0." };
  }
  if (!rows) return { error: "Rândurile de cantități nu au putut fi citite." };
  if (rows.length === 0) return { error: "Adaugă cel puțin o materie primă." };

  for (const row of rows) {
    const selfRefError = validateNotSelfReference(itemId, row.componentItemId);
    if (selfRefError) return { error: selfRefError };
    if (row.quantity <= 0) return { error: "Fiecare cantitate trebuie să fie mai mare ca 0." };
  }
  const seen = new Set(rows.map((r) => r.componentItemId));
  if (seen.size !== rows.length) return { error: "Un material nu poate apărea de două ori." };

  const percentages = quantitiesToPercentages(
    batchQty,
    rows.map((r) => ({ id: r.componentItemId, quantity: r.quantity })),
  );

  try {
    await addOrUpdateComponents(
      recipeId,
      percentages.map((p) => ({ componentItemId: p.id, percentage: p.percentage })),
    );
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut salva rețeta." };
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

/** Rezultatul actiunilor de arhivare/restaurare (dialogul de confirmare). */
export interface RecipeArchiveResult {
  error: string | null;
}

async function toggleRecipeArchived(
  recipeId: string,
  itemId: string,
  archive: boolean,
): Promise<RecipeArchiveResult> {
  await requireRole(["admin", "operator"]);
  if (!recipeId) return { error: "Rețetă invalidă." };

  try {
    await setRecipeArchived(recipeId, archive);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut actualiza rețeta." };
  }

  revalidatePath("/retete");
  revalidatePath(`/retete/${itemId}`);
  return { error: null };
}

/** Arhiveaza o reteta intreaga (migrarea 0035) - doar staff, dupa confirmare. */
export async function archiveRecipeAction(
  recipeId: string,
  itemId: string,
): Promise<RecipeArchiveResult> {
  return toggleRecipeArchived(recipeId, itemId, true);
}

/** Restaureaza o reteta arhivata - doar staff, dupa confirmare. */
export async function restoreRecipeAction(
  recipeId: string,
  itemId: string,
): Promise<RecipeArchiveResult> {
  return toggleRecipeArchived(recipeId, itemId, false);
}
