import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { OrgStatus } from "./types";

// Cod Postgres pentru violare de constraint UNIQUE (ex. `organizations.slug`).
const ERR_UNIQUE_VIOLATION = "23505";

/** Slug deja folosit de o alta organizatie (constraint `organizations_slug_key`). */
export class SlugTakenError extends Error {
  constructor(public readonly slug: string) {
    super(`Slug-ul "${slug}" este deja folosit.`);
    this.name = "SlugTakenError";
  }
}

/**
 * Trimiterea invitatiei catre adminul initial a esuat (ex. exista deja un cont
 * Supabase Auth cu acest email). Organizatia RAMANE creata — apelantul trebuie sa
 * permita re-incercarea, nu sa ascunda starea partiala.
 */
export class InviteFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InviteFailedError";
  }
}

/**
 * Invitatia a plecat (cont Auth creat), dar profilul din `profiles` nu a putut fi
 * salvat. Starea e si mai partiala decat `InviteFailedError` — contul Auth exista
 * deja, deci re-incercarea trebuie tratata separat (in UI: mesaj clar + suport).
 */
export class ProfileCreateFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileCreateFailedError";
  }
}

/**
 * Creeaza randul organizatiei (clientul admin service-role, cerut de Task I: operatie
 * de administrare a platformei, nu tine de sesiunea/RLS-ul unui tenant). Nu invita
 * inca adminul — pasii sunt separati explicit ca sa poata fi re-incercati independent.
 */
export async function createOrganizationRow(name: string, slug: string): Promise<string> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .insert({ name, slug })
    .select("id")
    .single();

  if (error) {
    if (error.code === ERR_UNIQUE_VIOLATION) throw new SlugTakenError(slug);
    throw new Error(error.message || "Nu am putut crea organizatia.");
  }
  return data.id;
}

/**
 * Invita adminul initial al organizatiei (Supabase Auth) + ii creeaza profilul legat
 * de organizatie, cu rol `admin`. Idempotent la nivel de apel: poate fi re-chemata
 * pentru aceeasi organizatie daca o incercare anterioara a esuat (ex. alta adresa de
 * email, sau retrimitere dupa ce problema a fost rezolvata).
 */
export async function inviteOrganizationAdmin(
  organizationId: string,
  email: string,
  redirectTo: string,
): Promise<void> {
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
  if (error || !data?.user) {
    throw new InviteFailedError(
      error?.message || "Nu am putut trimite invitatia (poate exista deja un cont cu acest email).",
    );
  }

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    organization_id: organizationId,
    role: "admin",
    email,
  });
  if (profileError) {
    throw new ProfileCreateFailedError(
      profileError.message || "Contul a fost creat, dar profilul nu a putut fi salvat.",
    );
  }
}

/**
 * Suspenda/reactiveaza o organizatie. Foloseste clientul de sesiune (nu service-role):
 * RLS (`organizations_update`) permite explicit super-adminului sa modifice orice
 * organizatie (`app.is_admin_of` include `app.is_super_admin()`), deci nu e nevoie sa
 * ocolim RLS aici — pastram operatia auditabila prin identitatea apelantului.
 */
export async function setOrganizationStatus(
  organizationId: string,
  status: OrgStatus,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ status })
    .eq("id", organizationId);

  if (error) {
    throw new Error(
      status === "suspended"
        ? "Nu am putut suspenda organizatia."
        : "Nu am putut reactiva organizatia.",
    );
  }
}
