"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/features/auth/session";
import {
  LOGO_VARIANTS,
  logoColumnPatch,
  parseLogoVariant,
  validateLogoFile,
  type LogoVariant,
} from "./logo-validation";
import { trimLogo } from "./logo-processing";
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
      // Culorile lipsesc din formular cand organizatia are o tema aleasa de platforma
      // (docs/plans/tema-vs-culori-organizatie.md) - atunci NU le stergem: revin daca
      // organizatia trece inapoi pe tema implicita.
      ...(formData.has("primary_color")
        ? {
            primary_color: clean(formData.get("primary_color")),
            secondary_color: clean(formData.get("secondary_color")),
          }
        : {}),
      email_from_name: clean(formData.get("email_from_name")),
      // Adresa expeditorului + domeniul de email le seteaza super-adminul (0050).
      email_reply_to: clean(formData.get("email_reply_to")),
      cui: clean(formData.get("cui")),
      reg_com: clean(formData.get("reg_com")),
      address: clean(formData.get("address")),
    })
    .eq("id", user.organizationId);

  if (error) {
    return { error: "Nu am putut salva setarile. Incearca din nou.", message: null };
  }

  // Tema/numele se reflecta in shell (sidebar) imediat.
  revalidatePath("/", "layout");
  return { error: null, message: "Setarile au fost salvate." };
}

/**
 * Incarca (sau inlocuieste) o varianta de logo a organizatiei curente (camp
 * `variant`: `inline` = orizontal, `square` = patrat - `LOGO_VARIANTS`) in
 * bucket-ul public `org-logos`, la un path FIX per organizatie si varianta
 * (`${organizationId}/logo`, `${organizationId}/logo-square`, cu upsert) - un
 * singur obiect per varianta, fara fisiere orfane la inlocuire.
 * Foloseste clientul admin pentru upload (bucketul nu are politici pe
 * `storage.objects`, vezi migrarea) - autorizarea e facuta aici, la nivel de
 * server action. URL-ul public salvat in coloana variantei primeste un
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

  const variant = parseLogoVariant(formData.get("variant"));
  if (!variant) return { error: "Varianta de logo necunoscută.", message: null };
  const { fileName } = LOGO_VARIANTS[variant];

  const file = formData.get("logo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Alege un fișier pentru logo.", message: null };
  }

  const validationError = validateLogoFile({ size: file.size, type: file.type });
  if (validationError) return { error: validationError, message: null };

  const admin = createAdminClient();
  const path = `${user.organizationId}/${fileName}`;

  const body = await trimLogo(Buffer.from(await file.arrayBuffer()), file.type);

  const { error: uploadError } = await admin.storage.from(LOGO_BUCKET).upload(path, body, {
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
    .update(logoColumnPatch(variant, `${publicUrl}?v=${Date.now()}`))
    .eq("id", user.organizationId);

  if (error) {
    return { error: "Nu am putut salva logo-ul.", message: null };
  }

  revalidatePath("/", "layout");
  return { error: null, message: "Logo-ul a fost actualizat." };
}

/**
 * Sterge o varianta de logo a organizatiei curente (fisier din storage +
 * referinta din DB); cealalta varianta ramane neatinsa. Apelata direct din
 * `onClick` (fara FormData), la fel ca `acceptReturnAction`.
 */
export async function removeOrgLogoAction(variantInput: LogoVariant): Promise<SettingsState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || !user.organizationId) {
    return { error: "Nu ai permisiunea de a modifica setarile organizatiei.", message: null };
  }

  // Argumentul vine de la client - validat, nu doar tipat.
  const variant = parseLogoVariant(variantInput);
  if (!variant) return { error: "Varianta de logo necunoscută.", message: null };
  const { fileName } = LOGO_VARIANTS[variant];

  const admin = createAdminClient();
  await admin.storage.from(LOGO_BUCKET).remove([`${user.organizationId}/${fileName}`]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update(logoColumnPatch(variant, null))
    .eq("id", user.organizationId);

  if (error) {
    return { error: "Nu am putut elimina logo-ul.", message: null };
  }

  revalidatePath("/", "layout");
  return { error: null, message: "Logo-ul a fost eliminat." };
}
