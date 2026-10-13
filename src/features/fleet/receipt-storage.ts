import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FuelReceipt } from "./types";
import { validateReceiptFile } from "./validation";

/** Bucketul privat din migrarea 0056 - fara politici pe `storage.objects`. */
export const FLEET_RECEIPTS_BUCKET = "fleet-receipts";

function sanitizeFileName(name: string): string {
  return (
    name
      .trim()
      .slice(-120)
      .replace(/[^a-zA-Z0-9._-]/g, "_") || "bon"
  );
}

/**
 * Incarca bonul unei alimentari (clientul admin: bucketul nu are politici, autorizarea
 * o face APELANTUL - server action cu `requireRole` + `requireModule`). Path-ul incepe
 * cu organizatia, ca obiectele sa poata fi exportate per tenant.
 */
export async function uploadFuelReceipt(organizationId: string, file: File): Promise<FuelReceipt> {
  const validationError = validateReceiptFile({ size: file.size, type: file.type });
  if (validationError) throw new Error(validationError);

  const path = `${organizationId}/${randomUUID()}-${sanitizeFileName(file.name)}`;
  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(FLEET_RECEIPTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error("Nu am putut încărca bonul.");
  return { path, fileName: file.name, mimeType: file.type };
}

/** Sterge un bon inlocuit/scos - best effort (un obiect orfan nu strica nimic). */
export async function removeFuelReceipt(path: string): Promise<void> {
  try {
    await createAdminClient().storage.from(FLEET_RECEIPTS_BUCKET).remove([path]);
  } catch (err) {
    console.error(`[fleet] nu am putut sterge bonul ${path}:`, err);
  }
}

/** URL semnat (60s) - doar dupa ce apelantul a citit randul prin RLS. */
export async function fuelReceiptSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .storage.from(FLEET_RECEIPTS_BUCKET)
    .createSignedUrl(path, 60);
  return error || !data ? null : data.signedUrl;
}
