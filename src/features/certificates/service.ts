import { createElement } from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/features/auth/session";
import type { Database, Json } from "@/lib/database.types";
import { CertificatePdfDocument } from "./pdf";
import { fetchOrderTraceabilityRawData } from "./repository";
import { buildTraceabilityGraph } from "./traceability";
import {
  TRACEABILITY_SNAPSHOT_VERSION,
  type CertificateRecord,
  type DeliveredLotLine,
  type TraceabilitySnapshot,
  type TraceabilitySnapshotItem,
} from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Subsetul de coloane selectat de `mapCertificate` (fara `created_at`/`updated_at`). */
type CertificateSelectRow = Pick<
  Database["public"]["Tables"]["certificates"]["Row"],
  | "id"
  | "organization_id"
  | "order_id"
  | "number"
  | "issued_at"
  | "pdf_path"
  | "traceability_snapshot"
>;

/** Numele bucket-ului privat creat in migrarea 0009_certificates_storage.sql. */
export const CERTIFICATES_BUCKET = "certificates";

/** Durata de valabilitate a unui URL semnat de descarcare (secunde) — ca la documente. */
const SIGNED_URL_TTL_SECONDS = 60;

/** Certificatul nu exista sau nu e accesibil apelantului (RLS pe `certificates`). */
export class CertificateAccessError extends Error {
  constructor(public readonly certificateId: string) {
    super("Certificat inexistent sau fără acces.");
    this.name = "CertificateAccessError";
  }
}

/** Comanda pentru care se cere generarea certificatului nu exista/nu e accesibila. */
export class CertificateOrderNotFoundError extends Error {
  constructor(public readonly orderId: string) {
    super("Comanda nu există sau nu este accesibilă.");
    this.name = "CertificateOrderNotFoundError";
  }
}

function mapCertificate(row: CertificateSelectRow): CertificateRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    orderId: row.order_id,
    number: row.number,
    issuedAt: row.issued_at,
    pdfPath: row.pdf_path,
    // `traceability_snapshot` e jsonb liber la nivel de DB; forma e garantata de
    // acest modul (singurul care scrie randul) — vezi TraceabilitySnapshot.
    snapshot: row.traceability_snapshot as unknown as TraceabilitySnapshot,
  };
}

/** Reface un `Json` "curat" (fara `undefined`/instante de clasa) pt. coloana jsonb. */
function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

/** Numar de certificat nou, unic per organizatie (RPC `generate_certificate_number`). */
export async function generateCertificateNumber(organizationId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_certificate_number", {
    p_org: organizationId,
  });
  if (error || !data) {
    throw new Error(error?.message ?? "Nu am putut genera numărul certificatului.");
  }
  return data;
}

/** Certificatul unei comenzi, daca a fost deja generat (`null` altfel — comanda index unic). */
export async function getCertificateByOrderId(orderId: string): Promise<CertificateRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificates")
    .select("id, organization_id, order_id, number, issued_at, pdf_path, traceability_snapshot")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new Error("Nu am putut verifica certificatul comenzii.");
  return data ? mapCertificate(data) : null;
}

function aggregateDeliveredItems(delivered: DeliveredLotLine[]): TraceabilitySnapshotItem[] {
  const byItem = new Map<string, TraceabilitySnapshotItem>();
  for (const line of delivered) {
    const existing = byItem.get(line.itemId);
    if (existing) {
      existing.quantity += line.quantity;
    } else {
      byItem.set(line.itemId, {
        itemId: line.itemId,
        itemTitle: line.itemTitle,
        unit: line.unit,
        quantity: line.quantity,
      });
    }
  }
  return [...byItem.values()];
}

interface OrderForSnapshot {
  organizationId: string;
  snapshot: TraceabilitySnapshot;
}

/**
 * Construieste snapshot-ul de trasabilitate (sectiunea 1, Task G): fetch datele
 * brute (repository.ts, iterativ, respecta RLS) apoi apeleaza functia PURA
 * `buildTraceabilityGraph` (traceability.ts). Rezultatul e menit sa fie
 * INGHETAT in `certificates.traceability_snapshot` — reproductibil chiar daca
 * stocul se schimba ulterior.
 */
export async function buildOrderTraceabilitySnapshot(
  supabase: SupabaseClient,
  orderId: string,
): Promise<OrderForSnapshot | null> {
  const { data: order, error } = await supabase
    .from("orders")
    .select("id, organization_id, order_number, clients(name, cui)")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error("Nu am putut încărca comanda pentru certificat.");
  if (!order) return null;

  const raw = await fetchOrderTraceabilityRawData(supabase, orderId);
  const { graph, materials } = buildTraceabilityGraph(raw);

  const snapshot: TraceabilitySnapshot = {
    version: TRACEABILITY_SNAPSHOT_VERSION,
    generatedAt: new Date().toISOString(),
    order: {
      id: order.id,
      number: order.order_number,
      clientName: order.clients?.name ?? "—",
      clientCui: order.clients?.cui ?? "—",
    },
    deliveredItems: aggregateDeliveredItems(raw.delivered),
    graph,
    materials,
  };

  return { organizationId: order.organization_id, snapshot };
}

/** Randeaza PDF-ul certificatului (buffer) — vezi decizia S3/PDF in pdf.tsx. */
async function renderCertificatePdf(
  snapshot: TraceabilitySnapshot,
  orgName: string,
  brandColor?: string | null,
  accentColor?: string | null,
): Promise<Buffer> {
  const element = createElement(CertificatePdfDocument, {
    snapshot,
    orgName,
    brandColor: brandColor ?? undefined,
    accentColor: accentColor ?? undefined,
  });
  // `renderToBuffer` tipizeaza strict argumentul ca `ReactElement<DocumentProps>`
  // (props-urile <Document>-ului react-pdf), desi accepta la runtime orice element
  // care randeaza in final un <Document> (cazul nostru — CertificatePdfDocument e
  // un wrapper cu props proprii). Cast explicit, documentat, nu un `any` implicit.
  return renderToBuffer(element as unknown as Parameters<typeof renderToBuffer>[0]);
}

export interface GenerateCertificateResult {
  certificate: CertificateRecord;
  /** `false` daca certificatul exista deja (idempotent — nu s-a regenerat nimic). */
  created: boolean;
}

/**
 * Genereaza certificatul unei comenzi — apelat din
 * `orders/notifications.ts#onOrderStatusChanged` la `toStatus==='closed'`.
 * IDEMPOTENT: `certificates.order_id` e UNIQUE (0001_core_schema.sql); daca
 * exista deja un rand, il returneaza neschimbat, fara sa regenereze
 * numarul/PDF-ul/snapshot-ul. Doar staff (admin/operator) — comanda ajunge
 * aici mereu dintr-o actiune de staff (inchiderea comenzii), dar verificarea
 * ramane si aici ca a doua linie de aparare (in stilul `deleteDocument`).
 *
 * Pasii (dupa idempotenta): 1) construieste snapshot-ul de trasabilitate
 * (query-uri prin clientul UTILIZATORULUI — RLS ramane in vigoare); 2) genereaza
 * numarul (RPC, siguranta la concurenta din 0009); 3) randeaza PDF-ul; 4) incarca
 * PDF-ul SI insereaza randul `certificates` prin clientul ADMIN (acelasi motiv
 * ca la `uploadDocument`: bucketul `certificates` nu are politici pe
 * `storage.objects`). La esecul insertului, sterge fisierul deja incarcat
 * (best-effort) — daca insertul a esuat din cauza unei curse (alt request a
 * generat certificatul intre timp), recitim si returnam randul existent.
 */
export async function generateCertificateForOrder(
  orderId: string,
): Promise<GenerateCertificateResult> {
  await requireRole(["admin", "operator"]);

  const existing = await getCertificateByOrderId(orderId);
  if (existing) return { certificate: existing, created: false };

  const supabase = await createClient();
  const built = await buildOrderTraceabilitySnapshot(supabase, orderId);
  if (!built) throw new CertificateOrderNotFoundError(orderId);
  const { organizationId, snapshot } = built;

  const { data: org } = await supabase
    .from("organizations")
    .select("name, primary_color, secondary_color")
    .eq("id", organizationId)
    .maybeSingle();

  const number = await generateCertificateNumber(organizationId);
  const pdfBuffer = await renderCertificatePdf(
    snapshot,
    org?.name ?? "Lateris Trace",
    org?.primary_color,
    org?.secondary_color,
  );

  const admin = createAdminClient();
  const path = `${organizationId}/${orderId}/${number}.pdf`;

  const { error: uploadError } = await admin.storage
    .from(CERTIFICATES_BUCKET)
    .upload(path, pdfBuffer, {
      contentType: "application/pdf",
      upsert: false,
    });
  if (uploadError) throw new Error("Nu am putut încărca PDF-ul certificatului.");

  const { data: inserted, error: insertError } = await admin
    .from("certificates")
    .insert({
      organization_id: organizationId,
      order_id: orderId,
      number,
      traceability_snapshot: toJson(snapshot),
      pdf_path: path,
    })
    .select("id, organization_id, order_id, number, issued_at, pdf_path, traceability_snapshot")
    .single();

  if (insertError || !inserted) {
    await admin.storage.from(CERTIFICATES_BUCKET).remove([path]);
    const raceExisting = await getCertificateByOrderId(orderId);
    if (raceExisting) return { certificate: raceExisting, created: false };
    throw new Error("Nu am putut salva certificatul.");
  }

  return { certificate: mapCertificate(inserted), created: true };
}

/**
 * URL semnat, temporar, de descarcare a PDF-ului certificatului — acelasi
 * pattern ca `documents/service.ts#getDownloadUrl`: verifica intai RLS pe
 * randul `certificates` (clientul utilizatorului — staff vede tot din
 * organizatia proprie, clientul doar certificatele comenzilor sale, vezi
 * `certificates_client_select` din 0001_core_schema.sql), apoi semneaza URL-ul
 * cu clientul admin (bucketul nu are politici pe `storage.objects`).
 */
export async function getCertificateDownloadUrl(certificateId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("certificates")
    .select("pdf_path")
    .eq("id", certificateId)
    .single();
  if (error || !data || !data.pdf_path) throw new CertificateAccessError(certificateId);

  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from(CERTIFICATES_BUCKET)
    .createSignedUrl(data.pdf_path, SIGNED_URL_TTL_SECONDS);
  if (signError || !signed) throw new Error("Nu am putut genera link-ul de descărcare.");
  return signed.signedUrl;
}
