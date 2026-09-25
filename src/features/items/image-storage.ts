import { createAdminClient } from "@/lib/supabase/admin";
import { validateItemImageFile } from "./image-validation";

/** Bucket-ul public creat in migrarea 0021_item_images_storage.sql. */
export const ITEM_IMAGE_BUCKET = "item-images";

/**
 * Incarca poza unui item la path-ul fix `${itemId}/image` (upsert - un singur
 * obiect per item, fara fisiere orfane la inlocuire) si intoarce URL-ul public,
 * cu parametru de cache-busting (altfel browserul ar continua sa arate poza
 * veche de la acelasi URL). Foloseste clientul admin - bucketul nu are politici
 * pe `storage.objects`, autorizarea e facuta de APELANT (`requireRole` in
 * `actions.ts`, respectiv rolurile tool-ului de asistent `seteaza_imagine_produs`).
 * Arunca `Error` cu mesaj RO gata de afisat daca fisierul e invalid sau
 * upload-ul esueaza.
 */
export async function uploadItemImage(
  itemId: string,
  file: Blob,
  contentType: string = file.type,
): Promise<string> {
  const validationError = validateItemImageFile({ size: file.size, type: contentType });
  if (validationError) throw new Error(validationError);

  const admin = createAdminClient();
  const path = `${itemId}/image`;
  const { error: uploadError } = await admin.storage.from(ITEM_IMAGE_BUCKET).upload(path, file, {
    contentType,
    upsert: true,
  });
  if (uploadError) throw new Error("Nu am putut încărca imaginea.");

  const {
    data: { publicUrl },
  } = admin.storage.from(ITEM_IMAGE_BUCKET).getPublicUrl(path);
  return `${publicUrl}?v=${Date.now()}`;
}
