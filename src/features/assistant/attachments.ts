import { createAdminClient } from "@/lib/supabase/admin";
import {
  ATTACHMENT_BUCKET,
  resolveMimeType,
  sanitizeFileName,
  validateAttachment,
  type AttachmentMeta,
} from "./attachment-rules";
import { assistantDb } from "./db";
import type { ToolContext } from "./types";

/**
 * Atasamentele din chat (migrarea 0036). Regula de securitate: orice acces la FISIER
 * (clientul admin, fara RLS) trece intai prin `getAttachment`, care citeste randul pe
 * sesiunea utilizatorului - RLS-ul decide daca atasamentul e al lui. Un ID ghicit de
 * model (sau scris de mana in mesaj) nu deschide fisierul altcuiva.
 */

interface AttachmentRow {
  id: string;
  organization_id: string;
  user_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export interface StoredAttachment extends AttachmentMeta {
  storagePath: string;
}

function mapRow(row: AttachmentRow): StoredAttachment {
  return {
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    storagePath: row.storage_path,
  };
}

export class AttachmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentError";
  }
}

/**
 * Valideaza, inregistreaza atasamentul (pe sesiune - RLS) si emite URL-ul semnat de
 * upload: browserul urca fisierul direct in Storage (Vercel limiteaza corpul unei
 * cereri catre server la 4.5MB).
 */
export async function registerAttachment(
  ctx: ToolContext,
  file: { name: string; type: string; size: number },
): Promise<{ attachment: AttachmentMeta; path: string; token: string }> {
  if (!ctx.organizationId) throw new AttachmentError("Contul nu are o organizație asociată.");
  const error = validateAttachment(file);
  if (error) throw new AttachmentError(error);

  // Tipul canonic (dupa extensie pentru documentele text) - cel acceptat de bucket.
  const mimeType = resolveMimeType(file.name, file.type);
  const id = crypto.randomUUID();
  const path = `${ctx.organizationId}/${ctx.userId}/${id}`;
  const fileName = sanitizeFileName(file.name);

  const db = await assistantDb();
  const { error: insertError } = await db.from("assistant_attachments").insert({
    id,
    organization_id: ctx.organizationId,
    user_id: ctx.userId,
    storage_path: path,
    file_name: fileName,
    mime_type: mimeType,
    size_bytes: file.size,
  });
  if (insertError) throw new AttachmentError("Nu am putut înregistra atașamentul.");

  const { data, error: signError } = await createAdminClient()
    .storage.from(ATTACHMENT_BUCKET)
    .createSignedUploadUrl(path);
  if (signError || !data) throw new AttachmentError("Nu am putut pregăti încărcarea fișierului.");

  return {
    attachment: { id, fileName, mimeType, sizeBytes: file.size },
    path,
    token: data.token,
  };
}

/** Atasamentul utilizatorului curent (RLS), sau `null` daca nu exista / nu e al lui. */
export async function getAttachment(id: string): Promise<StoredAttachment | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = await assistantDb();
  const { data } = await db
    .from("assistant_attachments")
    .select(
      "id, organization_id, user_id, storage_path, file_name, mime_type, size_bytes, created_at",
    )
    .eq("id", id)
    .maybeSingle();
  return data ? mapRow(data as AttachmentRow) : null;
}

/** Continutul fisierului. Primeste DOAR un atasament obtinut prin `getAttachment`. */
export async function downloadAttachment(attachment: StoredAttachment): Promise<Blob> {
  const { data, error } = await createAdminClient()
    .storage.from(ATTACHMENT_BUCKET)
    .download(attachment.storagePath);
  if (error || !data) {
    throw new AttachmentError(
      `Fișierul „${attachment.fileName}” nu a putut fi citit (poate încărcarea nu s-a terminat).`,
    );
  }
  return data;
}

/** URL temporar pentru previzualizare (ex. imaginea din cardul de confirmare). */
export async function attachmentPreviewUrl(
  attachment: StoredAttachment,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const { data } = await createAdminClient()
    .storage.from(ATTACHMENT_BUCKET)
    .createSignedUrl(attachment.storagePath, expiresInSeconds);
  return data?.signedUrl ?? null;
}
