"use server";

import { revalidatePath } from "next/cache";
import { deleteDocument, getDownloadUrl, uploadDocument } from "./service";
import { isDocumentOwnerType } from "./types";
import type { DocumentActionState } from "./action-state";

function clean(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

function revalidateIfRequested(formData: FormData): void {
  const path = clean(formData.get("revalidate_path"));
  if (path) revalidatePath(path);
}

/**
 * Incarca un document nou (formularul `DocumentUpload`). Genericã - folosita de
 * orice feature care ataseaza documente unui owner (client/order/item); consumatorul
 * seteaza `owner_type` / `owner_id` / `revalidate_path` ca hidden fields.
 */
export async function uploadDocumentAction(
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const ownerType = clean(formData.get("owner_type"));
  const ownerId = clean(formData.get("owner_id"));
  const file = formData.get("file");
  const description = clean(formData.get("description"));

  if (!ownerType || !isDocumentOwnerType(ownerType)) {
    return { error: "Entitate țintă invalidă." };
  }
  if (!ownerId) return { error: "Entitate țintă invalidă." };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Alege un fișier." };
  }

  try {
    await uploadDocument({ ownerType, ownerId, file, description });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut încărca documentul." };
  }

  revalidateIfRequested(formData);
  return { error: null };
}

/** Sterge un document - restrictionat la staff in `deleteDocument` (service.ts). */
export async function deleteDocumentAction(
  _prev: DocumentActionState,
  formData: FormData,
): Promise<DocumentActionState> {
  const documentId = clean(formData.get("document_id"));
  if (!documentId) return { error: "Document invalid." };

  try {
    await deleteDocument(documentId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut șterge documentul." };
  }

  revalidateIfRequested(formData);
  return { error: null };
}

export interface DownloadUrlResult {
  url: string | null;
  error: string | null;
}

/**
 * Genereaza un link semnat de descarcare. Apelata direct (nu ca form action) din
 * `DocumentList`, la click pe "Descarcă".
 */
export async function getDownloadUrlAction(documentId: string): Promise<DownloadUrlResult> {
  try {
    const url = await getDownloadUrl(documentId);
    return { url, error: null };
  } catch (err) {
    return {
      url: null,
      error: err instanceof Error ? err.message : "Nu am putut genera link-ul de descărcare.",
    };
  }
}
