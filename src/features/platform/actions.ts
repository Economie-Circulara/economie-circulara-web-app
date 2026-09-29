"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { getOrganizationOrigin } from "@/features/auth/origin";
import { isLayoutKey } from "@/features/branding/layouts";
import { isThemeKey } from "@/features/branding/themes";
import { normalizeCustomDomain } from "./domain";
import {
  EMAIL_DOMAIN_STATUS_LABELS,
  normalizeEmailDomain,
  normalizeLocalPart,
} from "./email-domain";
import { EmailDomainProviderError, getEmailDomainProvider } from "./email-domain-provider";
import {
  EmailDomainNotConfiguredError,
  configureEmailDomain,
  refreshEmailDomain,
  removeEmailDomain,
} from "./email-domain-service";
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
import type {
  CreateOrganizationState,
  OrgAppearanceState,
  OrgEmailState,
  OrgStatusState,
} from "./form-state";

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

const NO_EMAIL_PROVIDER_ERROR =
  "Gestionarea domeniilor de email nu e configurata: seteaza RESEND_API_KEY (cheie Resend cu acces complet) in Vercel - vezi docs/setup.md.";

function emailProviderErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof EmailDomainProviderError) return err.message;
  if (err instanceof EmailDomainNotConfiguredError) return err.message;
  return fallback;
}

function revalidateOrganization(organizationId: string) {
  revalidatePath("/platform");
  revalidatePath(`/platform/${organizationId}`);
}

/**
 * Domeniul de trimitere + adresa expeditorului unei organizatii (super-admin; plan
 * docs/plans/email-white-label-per-domeniu.md). Un domeniu nou se creeaza la Resend,
 * iar inregistrarile DNS de adaugat in Cloudflare apar in pagina; pana la verificare,
 * emailurile organizatiei pleaca de pe adresa platformei (cu numele organizatiei).
 */
export async function updateOrganizationEmailDomainAction(
  _prev: OrgEmailState,
  formData: FormData,
): Promise<OrgEmailState> {
  await requireRole(["super_admin"]);
  const organizationId = clean(formData.get("organization_id"));
  if (!organizationId) return { error: "Organizatie invalida.", message: null };

  const domain = normalizeEmailDomain(clean(formData.get("email_domain")));
  if (!domain.ok) return { error: domain.error, message: null };
  const localPart = normalizeLocalPart(clean(formData.get("email_local_part")));
  if (!localPart.ok) return { error: localPart.error, message: null };

  const provider = getEmailDomainProvider();
  if (!provider) return { error: NO_EMAIL_PROVIDER_ERROR, message: null };

  try {
    await configureEmailDomain(
      organizationId,
      { domain: domain.value, localPart: localPart.value },
      provider,
    );
  } catch (err) {
    return {
      error: emailProviderErrorMessage(err, "Nu am putut salva domeniul de email."),
      message: null,
    };
  }

  revalidateOrganization(organizationId);
  return {
    error: null,
    message: domain.value
      ? "Salvat. Adauga inregistrarile DNS de mai jos, apoi apasa „Verifica DNS”."
      : "Domeniul de email a fost scos - emailurile pleaca de pe adresa platformei.",
  };
}

/** Cere reverificarea DNS a domeniului de email la Resend si salveaza statusul. */
export async function verifyOrganizationEmailDomainAction(
  _prev: OrgEmailState,
  formData: FormData,
): Promise<OrgEmailState> {
  await requireRole(["super_admin"]);
  const organizationId = clean(formData.get("organization_id"));
  if (!organizationId) return { error: "Organizatie invalida.", message: null };

  const provider = getEmailDomainProvider();
  if (!provider) return { error: NO_EMAIL_PROVIDER_ERROR, message: null };

  try {
    const info = await refreshEmailDomain(organizationId, provider);
    revalidateOrganization(organizationId);
    return {
      error: null,
      message:
        info.status === "verified"
          ? "Domeniul e verificat - emailurile pleaca de acum de pe adresa organizatiei."
          : `Status: ${EMAIL_DOMAIN_STATUS_LABELS[info.status]}. Propagarea DNS poate dura; reincearca peste cateva minute.`,
    };
  } catch (err) {
    return {
      error: emailProviderErrorMessage(err, "Nu am putut verifica domeniul de email."),
      message: null,
    };
  }
}

/**
 * Scoate domeniul de email al organizatiei (revine pe adresa platformei). Legat cu
 * `.bind(null, id)` si pasat lui `ConfirmActionButton` (AGENTS.md 4.2).
 */
export async function removeOrganizationEmailDomainAction(
  organizationId: string,
): Promise<{ error: string | null }> {
  await requireRole(["super_admin"]);
  if (!organizationId) return { error: "Organizatie invalida." };

  const provider = getEmailDomainProvider();
  if (!provider) return { error: NO_EMAIL_PROVIDER_ERROR };

  try {
    await removeEmailDomain(organizationId, provider);
  } catch (err) {
    return { error: emailProviderErrorMessage(err, "Nu am putut scoate domeniul de email.") };
  }
  revalidateOrganization(organizationId);
  return { error: null };
}
