"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { getOrganizationOrigin } from "@/features/auth/origin";
import { isLayoutKey } from "@/features/branding/layouts";
import { isThemeKey } from "@/features/branding/themes";
import { normalizeCustomDomain } from "./domain";
import { isValidSlug } from "./slug";
import {
  InviteFailedError,
  ProfileCreateFailedError,
  DomainTakenError,
  SlugTakenError,
  createOrganizationRow,
  inviteOrganizationAdmin,
  setOrganizationStatus,
  updateOrganizationAppearance,
} from "./service";
import type { CreateOrganizationState, OrgAppearanceState, OrgStatusState } from "./form-state";

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

const SLUG_ERROR_MESSAGE =
  "Slug invalid: litere mici, cifre si cratime, fara cratima la inceput sau sfarsit (ex. acme-recycling).";

/**
 * Creeaza o organizatie noua + invita adminul ei initial. Un singur formular acopera
 * doua scenarii:
 *  - prima trimitere: creeaza organizatia, apoi invita adminul;
 *  - re-incercare (dupa esec partial): `organization_id` vine ascuns in formular, deci
 *    NU se mai creeaza organizatia a doua oara - se reia doar pasul de invitatie.
 * Esecul e mereu vizibil in state (organizationId + date completate se pastreaza),
 * niciodata ascuns: super-adminul vede clar ca organizatia exista si poate retrimite
 * invitatia.
 */
export async function createOrganizationAction(
  prev: CreateOrganizationState,
  formData: FormData,
): Promise<CreateOrganizationState> {
  await requireRole(["super_admin"]);

  const existingOrgId = clean(formData.get("organization_id")) || null;
  const name = clean(formData.get("name")) || prev.orgName;
  const slug = clean(formData.get("slug")).toLowerCase() || prev.orgSlug;
  const adminEmail = clean(formData.get("admin_email")).toLowerCase();

  let organizationId = existingOrgId;

  if (!organizationId) {
    if (!name) {
      return {
        ...prev,
        orgName: name,
        orgSlug: slug,
        error: "Numele organizatiei este obligatoriu.",
        message: null,
      };
    }
    if (!isValidSlug(slug)) {
      return { ...prev, orgName: name, orgSlug: slug, error: SLUG_ERROR_MESSAGE, message: null };
    }
    if (!adminEmail) {
      return {
        ...prev,
        orgName: name,
        orgSlug: slug,
        error: "Email-ul adminului initial este obligatoriu.",
        message: null,
      };
    }

    try {
      organizationId = await createOrganizationRow(name, slug);
    } catch (err) {
      const error =
        err instanceof SlugTakenError
          ? `Slug-ul "${slug}" este deja folosit de alta organizatie. Alege altul.`
          : "Nu am putut crea organizatia. Incearca din nou.";
      return { ...prev, orgName: name, orgSlug: slug, error, message: null };
    }
  }

  if (!adminEmail) {
    return {
      error: "Email-ul adminului este obligatoriu pentru a (re)trimite invitatia.",
      message: null,
      organizationId,
      orgName: name,
      orgSlug: slug,
      adminEmail: "",
    };
  }

  // Domeniul organizatiei TINTA, nu cel de pe care lucreaza super-adminul.
  const origin = await getOrganizationOrigin(organizationId);
  try {
    await inviteOrganizationAdmin(
      organizationId,
      adminEmail,
      `${origin}/auth/callback?next=/set-password`,
    );
  } catch (err) {
    const error =
      err instanceof ProfileCreateFailedError
        ? "Invitatia a fost trimisa, dar profilul adminului nu a putut fi salvat. Contacteaza suport."
        : err instanceof InviteFailedError
          ? err.message
          : "A aparut o eroare neasteptata la trimiterea invitatiei. Poti reincerca.";
    return {
      error,
      message: null,
      organizationId,
      orgName: name,
      orgSlug: slug,
      adminEmail,
    };
  }

  revalidatePath("/platform");
  redirect("/platform");
}

/** Suspenda o organizatie (super-admin). */
export async function suspendOrganizationAction(
  _prev: OrgStatusState,
  formData: FormData,
): Promise<OrgStatusState> {
  await requireRole(["super_admin"]);
  const organizationId = clean(formData.get("organization_id"));
  if (!organizationId) return { error: "Organizatie invalida." };

  try {
    await setOrganizationStatus(organizationId, "suspended");
  } catch {
    return { error: "Nu am putut suspenda organizatia." };
  }
  revalidatePath("/platform");
  return { error: null };
}

/** Reactiveaza o organizatie suspendata (super-admin). */
export async function reactivateOrganizationAction(
  _prev: OrgStatusState,
  formData: FormData,
): Promise<OrgStatusState> {
  await requireRole(["super_admin"]);
  const organizationId = clean(formData.get("organization_id"));
  if (!organizationId) return { error: "Organizatie invalida." };

  try {
    await setOrganizationStatus(organizationId, "active");
  } catch {
    return { error: "Nu am putut reactiva organizatia." };
  }
  revalidatePath("/platform");
  return { error: null };
}

/**
 * Tema vizuala, organizarea (meniu + panou) si domeniul propriu ale unei organizatii
 * (super-admin; plan multi-domain-tenant-profiles, T4/T5). Domeniul trebuie configurat si in Vercel +
 * Supabase Auth (docs/setup.md 3.1) - altfel userii organizatiei sunt redirectionati
 * pe un domeniu care nu raspunde.
 */
export async function updateOrganizationAppearanceAction(
  _prev: OrgAppearanceState,
  formData: FormData,
): Promise<OrgAppearanceState> {
  await requireRole(["super_admin"]);
  const organizationId = clean(formData.get("organization_id"));
  if (!organizationId) return { error: "Organizatie invalida.", message: null };

  const theme = clean(formData.get("theme"));
  if (!isThemeKey(theme)) return { error: "Tema necunoscuta.", message: null };

  const layout = clean(formData.get("layout"));
  if (!isLayoutKey(layout)) return { error: "Organizare necunoscuta.", message: null };

  const domain = normalizeCustomDomain(clean(formData.get("custom_domain")));
  if (!domain.ok) return { error: domain.error, message: null };

  try {
    await updateOrganizationAppearance(organizationId, {
      theme,
      layout,
      customDomain: domain.value,
    });
  } catch (err) {
    const error =
      err instanceof DomainTakenError
        ? `Domeniul "${err.domain}" este deja folosit de alta organizatie.`
        : "Nu am putut salva setarile organizatiei.";
    return { error, message: null };
  }

  revalidatePath("/platform");
  revalidatePath(`/platform/${organizationId}`);
  return { error: null, message: "Setarile au fost salvate." };
}
