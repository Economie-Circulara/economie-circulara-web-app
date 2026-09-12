"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { isValidSlug } from "./slug";
import {
  InviteFailedError,
  ProfileCreateFailedError,
  SlugTakenError,
  createOrganizationRow,
  inviteOrganizationAdmin,
  setOrganizationStatus,
} from "./service";
import type { CreateOrganizationState, OrgStatusState } from "./form-state";

function clean(value: FormDataEntryValue | null): string {
  return String(value ?? "").trim();
}

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

const SLUG_ERROR_MESSAGE =
  "Slug invalid: litere mici, cifre si cratime, fara cratima la inceput sau sfarsit (ex. acme-recycling).";

/**
 * Creeaza o organizatie noua + invita adminul ei initial. Un singur formular acopera
 * doua scenarii:
 *  - prima trimitere: creeaza organizatia, apoi invita adminul;
 *  - re-incercare (dupa esec partial): `organization_id` vine ascuns in formular, deci
 *    NU se mai creeaza organizatia a doua oara — se reia doar pasul de invitatie.
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

  const origin = await siteOrigin();
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
