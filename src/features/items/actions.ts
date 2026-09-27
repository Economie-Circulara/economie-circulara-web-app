"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { uploadItemImage } from "./image-storage";
import { itemListHref } from "./item-links";
import { KIND_OPTIONS, UNIT_OPTIONS } from "./labels";
import { createItem, setItemArchived, updateItem } from "./service";
import type { ItemKind, UnitOfMeasure } from "./types";
import type { ItemFormState } from "./action-state";

function clean(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

function parseUnit(value: FormDataEntryValue | null): UnitOfMeasure | null {
  const s = clean(value);
  return (UNIT_OPTIONS as string[]).includes(s ?? "") ? (s as UnitOfMeasure) : null;
}

function parseKind(value: FormDataEntryValue | null): ItemKind | null {
  const s = clean(value);
  return (KIND_OPTIONS as string[]).includes(s ?? "") ? (s as ItemKind) : null;
}

function parseSellable(formData: FormData): boolean {
  return formData.get("sellable") === "on";
}

/**
 * `items.is_tracked` (migrarea 0029). Comutatorul e afisat DOAR pentru itemii
 * fizici (item-form.tsx), deci pentru servicii cheia lipseste din payload - acolo
 * ramane `true` (irelevant: serviciile sunt sarite de la stoc pe ramura de `kind`).
 * Pentru itemii fizici, un checkbox nebifat nu trimite nimic => `false`.
 */
function parseIsTracked(formData: FormData, kind: ItemKind): boolean {
  if (kind !== "physical") return true;
  return formData.get("is_tracked") === "on";
}

/** Creeaza un item nou in catalog (formularul /itemi/nou) - doar staff (admin/operator). */
export async function createItemAction(
  _prev: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  const user = await requireRole(["admin", "operator"]);
  if (!user.organizationId) return { error: "Utilizatorul nu apartine unei organizatii." };

  const title = clean(formData.get("title"));
  const unit = parseUnit(formData.get("unit"));
  const kind = parseKind(formData.get("kind"));

  if (!title) return { error: "Titlul este obligatoriu." };
  if (!unit) return { error: "Alege o unitate de masura." };
  if (!kind) return { error: "Alege tipul materialului sau abonamentului." };

  // Id pre-generat: uploadul pozei (daca exista) se face INAINTE de insert,
  // ca o eroare de upload sa nu creeze un item orfan fara poza.
  const id = randomUUID();
  const imageFile = formData.get("image");
  let imageUrl: string | null = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      imageUrl = await uploadItemImage(id, imageFile);
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Nu am putut încărca imaginea." };
    }
  }

  try {
    await createItem({
      id,
      organizationId: user.organizationId,
      title,
      description: clean(formData.get("description")),
      unit,
      kind,
      isTracked: parseIsTracked(formData, kind),
      sellable: parseSellable(formData),
      imageUrl,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Nu am putut crea materialul sau abonamentul.",
    };
  }

  revalidatePath(itemListHref(kind));
  redirect(itemListHref(kind));
}

/** Actualizeaza un item existent (formularul /itemi/[id]) - doar staff (admin/operator). */
export async function updateItemAction(
  _prev: ItemFormState,
  formData: FormData,
): Promise<ItemFormState> {
  await requireRole(["admin", "operator"]);

  const id = clean(formData.get("id"));
  const title = clean(formData.get("title"));
  const unit = parseUnit(formData.get("unit"));
  const kind = parseKind(formData.get("kind"));

  if (!id) return { error: "Material sau abonament invalid." };
  if (!title) return { error: "Titlul este obligatoriu." };
  if (!unit) return { error: "Alege o unitate de masura." };
  if (!kind) return { error: "Alege tipul materialului sau abonamentului." };

  // Tri-state pentru poza: fisier nou -> inlocuieste; bifa "elimina" -> null;
  // altfel cheia lipseste din payload si `updateItem` nu atinge poza existenta.
  const imageFile = formData.get("image");
  const removeImage = formData.get("remove_image") === "on";
  let imagePatch: { imageUrl: string | null } | Record<string, never> = {};
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      imagePatch = { imageUrl: await uploadItemImage(id, imageFile) };
    } catch (err) {
      return { error: err instanceof Error ? err.message : "Nu am putut încărca imaginea." };
    }
  } else if (removeImage) {
    imagePatch = { imageUrl: null };
  }

  try {
    await updateItem(id, {
      title,
      description: clean(formData.get("description")),
      unit,
      kind,
      isTracked: parseIsTracked(formData, kind),
      sellable: parseSellable(formData),
      ...imagePatch,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Nu am putut salva materialul sau abonamentul.",
    };
  }

  revalidatePath(itemListHref(kind));
  redirect(itemListHref(kind));
}

/** Rezultatul actiunilor de arhivare/restaurare (dialogul de confirmare). */
export interface ArchiveActionResult {
  error: string | null;
}

async function toggleItemArchived(id: string, archive: boolean): Promise<ArchiveActionResult> {
  await requireRole(["admin", "operator"]);
  if (!id) return { error: "Material sau serviciu invalid." };

  try {
    await setItemArchived(id, archive);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Nu am putut actualiza materialul sau serviciul.",
    };
  }

  // Nu stim aici `kind`-ul - invalidam ambele ecrane (Materiale + Abonamente).
  for (const path of ["/itemi", `/itemi/${id}`, "/abonamente", `/abonamente/${id}`]) {
    revalidatePath(path);
  }
  return { error: null };
}

/**
 * Arhiveaza un item (migrarea 0035) - doar staff. Se apeleaza legat cu `.bind(null, id)`
 * din pagina, dupa confirmarea din `ConfirmActionButton`.
 */
export async function archiveItemAction(id: string): Promise<ArchiveActionResult> {
  return toggleItemArchived(id, true);
}

/** Restaureaza un item arhivat - doar staff. */
export async function restoreItemAction(id: string): Promise<ArchiveActionResult> {
  return toggleItemArchived(id, false);
}
