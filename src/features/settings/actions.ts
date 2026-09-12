"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/features/auth/session";
import { validateLogoFile } from "./logo-validation";
import type { SettingsState } from "./action-state";

/** Numele bucket-ului public creat in migrarea 0019_organization_logos_storage.sql. */
const LOGO_BUCKET = "org-logos";

function clean(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

/**
 * Actualizeaza brandingul / setarile organizatiei curente (doar admin, prin RLS).
 * Logo-ul NU se atinge aici - are propriile actiuni (`uploadOrgLogoAction` /
 * `removeOrgLogoAction`), incarcat direct ca fisier, nu ca URL text.
 */
export async function updateOrganizationAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || !user.organizationId) {
    return { error: "Nu ai permisiunea de a modifica setarile organizatiei.", message: null };
  }

  const name = clean(formData.get("name"));
  if (!name) return { error: "Numele organizatiei este obligatoriu.", message: null };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      primary_color: clean(formData.get("primary_color")),
      secondary_color: clean(formData.get("secondary_color")),
      custom_domain: clean(formData.get("custom_domain")),
      email_from_name: clean(formData.get("email_from_name")),
      email_from_address: clean(formData.get("email_from_address")),
    })
    .eq("id", user.organizationId);

  if (error) {
    // Cel mai probabil: custom_domain deja folosit de alta organizatie (unique).
    return {
      error: "Nu am putut salva setarile. Verifica daca domeniul nu e deja folosit.",
      message: null,
    };
  }

  // Tema/numele se reflecta in shell (sidebar) imediat.
  revalidatePath("/", "layout");
  return { error: null, message: "Setarile au fost salvate." };
}

/**
 * Incarca (sau inlocuieste) logo-ul organizatiei curente in bucket-ul public
 * `org-logos`, la un path FIX per organizatie (`${organizationId}/logo`, cu
 * upsert) - un singur obiect per organizatie, fara fisiere orfane la inlocuire.
 * Foloseste clientul admin pentru upload (bucketul nu are politici pe
 * `storage.objects`, vezi migrarea) - autorizarea e facuta aici, la nivel de
 * server action. URL-ul public salvat in `organizations.logo_url` primeste un
 * parametru de cache-busting, altfel browserul ar continua sa arate logo-ul
 * vechi de la acelasi URL (path fix).
 */
export async function uploadOrgLogoAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || !user.organizationId) {
    return { error: "Nu ai permisiunea de a modifica setarile organizatiei.", message: null };
  }

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Alege un fișier pentru logo.", message: null };
  }

  const validationError = validateLogoFile({ size: file.size, type: file.type });
  if (validationError) return { error: validationError, message: null };

  const admin = createAdminClient();
  const path = `${user.organizationId}/logo`;

  const { error: uploadError } = await admin.storage.from(LOGO_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) {
    return { error: "Nu am putut încărca logo-ul.", message: null };
  }

  const {
    data: { publicUrl },
  } = admin.storage.from(LOGO_BUCKET).getPublicUrl(path);

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ logo_url: `${publicUrl}?v=${Date.now()}` })
    .eq("id", user.organizationId);

  if (error) {
    return { error: "Nu am putut salva logo-ul.", message: null };
  }

  revalidatePath("/", "layout");
  return { error: null, message: "Logo-ul a fost actualizat." };
}

/**
 * Sterge logo-ul organizatiei curente (fisier din storage + referinta din DB).
 * Apelata direct din `onClick` (fara FormData), la fel ca `acceptReturnAction`.
 */
export async function removeOrgLogoAction(): Promise<SettingsState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || !user.organizationId) {
    return { error: "Nu ai permisiunea de a modifica setarile organizatiei.", message: null };
  }

  const admin = createAdminClient();
  await admin.storage.from(LOGO_BUCKET).remove([`${user.organizationId}/logo`]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ logo_url: null })
    .eq("id", user.organizationId);

  if (error) {
    return { error: "Nu am putut elimina logo-ul.", message: null };
  }

  revalidatePath("/", "layout");
  return { error: null, message: "Logo-ul a fost eliminat." };
}
