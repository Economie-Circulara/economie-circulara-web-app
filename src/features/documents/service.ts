import { randomUUID } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRole, requireUser, type SessionUser } from "@/features/auth/session";
import type { Database } from "@/lib/database.types";
import { validateFile } from "./validation";
import type { DocumentOwnerType, DocumentRecord } from "./types";

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

/** Numele bucket-ului privat creat in migrarea 0006_documents_storage.sql. */
export const DOCUMENTS_BUCKET = "documents";

/** Durata de valabilitate a unui URL semnat de descarcare (secunde). */
const SIGNED_URL_TTL_SECONDS = 60;

/** Ownerul (client/order/item) nu exista sau nu e accesibil apelantului (RLS). */
export class DocumentOwnerNotFoundError extends Error {
  constructor(
    public readonly ownerType: DocumentOwnerType,
    public readonly ownerId: string,
  ) {
    super(`Entitatea (${ownerType}) nu exista sau nu este accesibila.`);
    this.name = "DocumentOwnerNotFoundError";
  }
}

/** Fisierul nu respecta limitele de tip/marime (vezi validation.ts). */
export class InvalidFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidFileError";
  }
}

/**
 * Apelantul nu are voie sa incarce/stearga acest tip de document: documentele
 * generale ale organizatiei (declaratii de conformitate, 0057) sunt ale adminului;
 * clientul ataseaza documente DOAR comenzilor proprii (ca politica RLS de insert).
 */
export class DocumentPermissionError extends Error {
  constructor(message = "Nu ai drept să modifici acest document.") {
    super(message);
    this.name = "DocumentPermissionError";
  }
}

/** Documentul nu exista sau nu e accesibil apelantului (RLS pe `documents`). */
export class DocumentAccessError extends Error {
  constructor(public readonly documentId: string) {
    super("Document inexistent sau fara acces.");
    this.name = "DocumentAccessError";
  }
}

const OWNER_TABLE: Record<
  Exclude<DocumentOwnerType, "organization">,
  "clients" | "orders" | "items"
> = {
  client: "clients",
  order: "orders",
  item: "items",
};

/**
 * Cine poate INCARCA un document pe un tip de owner. Upload-ul trece prin clientul
 * admin (bucket fara politici, 0006), deci RLS-ul de insert de pe `documents` NU se
 * aplica - regula se impune aici, explicit:
 *  - documentele generale ale organizatiei: doar adminul ei (Setari);
 *  - clientul: doar pe comenzile proprii (aceeasi regula ca `documents_client_insert`);
 *    `resolveOwnerOrg` confirma prin RLS ca e comanda lui;
 *  - staff-ul: restul tipurilor, in organizatia lui (tot prin `resolveOwnerOrg`).
 * Exportata pentru teste.
 */
export function assertCanUpload(
  user: Pick<SessionUser, "role" | "organizationId">,
  ownerType: DocumentOwnerType,
  ownerId: string,
): void {
  if (ownerType === "organization") {
    if (user.role !== "admin" || user.organizationId !== ownerId) {
      throw new DocumentPermissionError(
        "Doar administratorul organizației poate încărca documente generale.",
      );
    }
    return;
  }
  if (user.role === "client" && ownerType !== "order") {
    throw new DocumentPermissionError("Poți atașa documente doar comenzilor tale.");
  }
}

function mapDocument(row: Omit<DocumentRow, "organization_id">): DocumentRecord {
  return {
    id: row.id,
    ownerType: row.owner_type,
    ownerId: row.owner_id,
    fileName: row.file_name,
    filePath: row.file_path,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    description: row.description,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim().slice(-150);
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "_") || "fisier";
}

function buildStoragePath(
  orgId: string,
  ownerType: DocumentOwnerType,
  ownerId: string,
  fileName: string,
): string {
  return `${orgId}/${ownerType}/${ownerId}/${randomUUID()}-${sanitizeFileName(fileName)}`;
}

/**
 * Rezolva organizatia ownerului (client/order/item/organizatie) folosind clientul
 * utilizatorului curent - RLS ii limiteaza vizibilitatea la ce are voie sa vada,
 * deci un rand gasit aici inseamna acces valid, fara logica de autorizare
 * duplicata in acest modul.
 */
async function resolveOwnerOrg(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ownerType: DocumentOwnerType,
  ownerId: string,
): Promise<string> {
  // Document general: ownerul ESTE organizatia (`assertCanUpload` a verificat deja ca
  // e organizatia adminului curent) - nu e nimic de rezolvat.
  if (ownerType === "organization") return ownerId;
  const table = OWNER_TABLE[ownerType];
  const { data, error } = await supabase
    .from(table)
    .select("organization_id")
    .eq("id", ownerId)
    .single();

  if (error || !data) {
    throw new DocumentOwnerNotFoundError(ownerType, ownerId);
  }
  return data.organization_id;
}

export interface UploadDocumentInput {
  ownerType: DocumentOwnerType;
  ownerId: string;
  file: File;
  description?: string | null;
}

/**
 * Incarca un document nou pentru un owner (client/order/item):
 *  1. verifica prin clientul UTILIZATORULUI (RLS) ca ownerul exista si e accesibil;
 *  2. valideaza tipul/marimea fisierului (vezi validation.ts);
 *  3. incarca fisierul SI insereaza randul `documents` prin clientul ADMIN
 *     (service-role) - necesar pentru ca bucketul nu are politici pe
 *     `storage.objects` (migrarea 0006), iar insertul in `documents` nu trebuie
 *     sa depinda de politicile RLS restrictive de pe acel tabel (ex. clientul nu
 *     poate insera documente de tip `client`).
 * La esecul insertului in `documents`, sterge fisierul deja incarcat (best-effort)
 * ca sa nu ramana obiecte orfane in storage.
 */
export async function uploadDocument(input: UploadDocumentInput): Promise<DocumentRecord> {
  const user = await requireUser();
  assertCanUpload(user, input.ownerType, input.ownerId);
  const supabase = await createClient();
  const orgId = await resolveOwnerOrg(supabase, input.ownerType, input.ownerId);

  const validationError = validateFile({ size: input.file.size, type: input.file.type });
  if (validationError) throw new InvalidFileError(validationError.message);

  const admin = createAdminClient();
  const path = buildStoragePath(orgId, input.ownerType, input.ownerId, input.file.name);

  const { error: uploadError } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, input.file, {
      contentType: input.file.type || undefined,
      upsert: false,
    });
  if (uploadError) {
    throw new Error("Nu am putut încărca fișierul.");
  }

  const { data, error } = await admin
    .from("documents")
    .insert({
      organization_id: orgId,
      owner_type: input.ownerType,
      owner_id: input.ownerId,
      file_path: path,
      file_name: input.file.name,
      mime_type: input.file.type || null,
      size_bytes: input.file.size,
      description: input.description ?? null,
      uploaded_by: user.id,
    })
    .select()
    .single();

  if (error || !data) {
    await admin.storage.from(DOCUMENTS_BUCKET).remove([path]);
    throw new Error("Nu am putut salva documentul.");
  }

  return mapDocument(data);
}

/** Lista documentelor unui owner - select simplu, filtrat de RLS pe `documents`. */
export async function listDocuments(
  ownerType: DocumentOwnerType,
  ownerId: string,
): Promise<DocumentRecord[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, owner_type, owner_id, file_name, file_path, mime_type, size_bytes, description, uploaded_by, created_at",
    )
    .eq("owner_type", ownerType)
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Nu am putut încărca documentele.");
  return (data ?? []).map(mapDocument);
}

/**
 * Documentele mai multor owneri de acelasi tip, intr-o singura interogare (ex.
 * documentele produselor de pe liniile unei comenzi). RLS filtreaza in continuare:
 * clientul vede doar documentele produselor VANDABILE (`documents_client_select`).
 */
export async function listDocumentsForOwners(
  ownerType: DocumentOwnerType,
  ownerIds: string[],
): Promise<DocumentRecord[]> {
  const ids = [...new Set(ownerIds)];
  if (ids.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, owner_type, owner_id, file_name, file_path, mime_type, size_bytes, description, uploaded_by, created_at",
    )
    .eq("owner_type", ownerType)
    .in("owner_id", ids)
    .order("created_at", { ascending: false });

  if (error) throw new Error("Nu am putut încărca documentele.");
  return (data ?? []).map(mapDocument);
}

/**
 * Documentele generale ale organizatiei (declaratii de conformitate, 0057) - vizibile
 * staff-ului si tuturor clientilor ei (RLS `documents_client_select`).
 */
export async function listOrganizationDocuments(
  organizationId: string | null,
): Promise<DocumentRecord[]> {
  if (!organizationId) return [];
  return listDocuments("organization", organizationId);
}

/**
 * URL semnat, temporar, de descarcare pentru un document. Verifica intai RLS pe
 * randul `documents` (select cu clientul utilizatorului - daca nu returneaza
 * rand, apelantul nu are acces), apoi semneaza URL-ul cu clientul admin (bucketul
 * nu e accesibil direct, fara politici pe `storage.objects`).
 */
export async function getDownloadUrl(documentId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("documents")
    .select("file_path")
    .eq("id", documentId)
    .single();

  if (error || !data) throw new DocumentAccessError(documentId);

  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(data.file_path, SIGNED_URL_TTL_SECONDS);

  if (signError || !signed) throw new Error("Nu am putut genera link-ul de descărcare.");
  return signed.signedUrl;
}

/**
 * Sterge un document - doar staff (admin/operator). Citeste `file_path` prin
 * clientul utilizatorului (RLS ca linie secundara de aparare), sterge obiectul
 * din storage cu clientul admin, apoi sterge randul prin clientul utilizatorului
 * (politica `documents_staff_all` permite delete pentru staff din organizatie).
 */
export async function deleteDocument(documentId: string): Promise<void> {
  const user = await requireRole(["admin", "operator"]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("documents")
    .select("file_path, owner_type")
    .eq("id", documentId)
    .single();
  if (error || !data) throw new DocumentAccessError(documentId);
  // Documentele generale (declaratii de conformitate, 0057) le gestioneaza doar adminul.
  if (data.owner_type === "organization" && user.role !== "admin") {
    throw new DocumentPermissionError(
      "Doar administratorul organizației poate șterge documente generale.",
    );
  }

  const admin = createAdminClient();
  await admin.storage.from(DOCUMENTS_BUCKET).remove([data.file_path]);

  const { error: deleteError } = await supabase.from("documents").delete().eq("id", documentId);
  if (deleteError) throw new Error("Nu am putut șterge documentul.");
}
