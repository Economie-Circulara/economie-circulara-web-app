"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole } from "@/features/auth/session";
import { validateItemImageFile } from "./image-validation";
import { KIND_OPTIONS, UNIT_OPTIONS } from "./labels";
import { createItem, updateItem } from "./service";
import type { ItemKind, UnitOfMeasure } from "./types";
import type { ItemFormState } from "./action-state";

/** Bucket-ul public creat in migrarea 0021_item_images_storage.sql. */
const ITEM_IMAGE_BUCKET = "item-images";

function clean(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

/**
 * Incarca poza unui item la path-ul fix `${itemId}/image` (upsert - un singur
 * obiect per item, fara fisiere orfane la inlocuire) si intoarce URL-ul public,
 * cu parametru de cache-busting (altfel browserul ar continua sa arate poza
 * veche de la acelasi URL). Foloseste clientul admin - bucketul nu are politici
 * pe `storage.objects`, autorizarea e facuta de apelant (`requireRole`).
 * Arunca `Error` cu mesaj RO gata de afisat daca fisierul e invalid sau
 * upload-ul esueaza.
 */
async function uploadItemImage(itemId: string, file: File): Promise<string> {
  const validationError = validateItemImageFile({ size: file.size, type: file.type });
  if (validationError) throw new Error(validationError);

  const admin = createAdminClient();
  const path = `${itemId}/image`;
  const { error: uploadError } = await admin.storage.from(ITEM_IMAGE_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) throw new Error("Nu am putut încărca imaginea.");

  const {
    data: { publicUrl },
  } = admin.storage.from(ITEM_IMAGE_BUCKET).getPublicUrl(path);
  return `${publicUrl}?v=${Date.now()}`;
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
  if (!kind) return { error: "Alege tipul materialului sau serviciului." };

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
      sellable: parseSellable(formData),
      imageUrl,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Nu am putut crea materialul sau serviciul.",
    };
  }

  revalidatePath("/itemi");
  redirect("/itemi");
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

  if (!id) return { error: "Material sau serviciu invalid." };
  if (!title) return { error: "Titlul este obligatoriu." };
  if (!unit) return { error: "Alege o unitate de masura." };
  if (!kind) return { error: "Alege tipul materialului sau serviciului." };

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
      sellable: parseSellable(formData),
      ...imagePatch,
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Nu am putut salva materialul sau serviciul.",
    };
  }

  revalidatePath("/itemi");
  redirect("/itemi");
}
