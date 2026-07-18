import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];
export type OrgStatus = Database["public"]["Enums"]["org_status"];

/** Ruta dedicata pentru userii unei organizatii suspendate (T2.1). */
export const SUSPENDED_ORG_PATH = "/organizatie-suspendata";

export interface SessionUser {
  id: string;
  email: string | null;
  role: UserRole;
  organizationId: string | null;
  clientId: string | null;
  fullName: string | null;
  /**
   * Statusul organizatiei userului curent. `null` pentru super_admin (fara
   * organizatie — trece peste tenant) sau daca organizatia n-a putut fi rezolvata.
   */
  organizationStatus: OrgStatus | null;
}

/**
 * Adevarat daca userul apartine unei organizatii SUSPENDATE (guard T2.1). Super_admin
 * nu are `organizationId`, deci nu poate fi niciodata "suspendat" pe aceasta cale.
 */
export function isOrgSuspended(
  user: Pick<SessionUser, "organizationId" | "organizationStatus">,
): boolean {
  return user.organizationId !== null && user.organizationStatus === "suspended";
}

/** Ruta principala (dashboard) in functie de rol. */
export function homePathForRole(role: UserRole): string {
  switch (role) {
    case "client":
      return "/portal";
    case "super_admin":
      return "/platform";
    case "admin":
    case "operator":
    default:
      return "/dashboard";
  }
}

/**
 * Utilizatorul curent + profilul lui (rol, organizatie, client). `null` daca nu e
 * autentificat sau daca nu are inca profil (ex. invitat care nu a fost provizionat).
 * Foloseste getUser() (verificat pe server), nu sesiunea din cookie.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Embed `organizations(status)` (relatia profiles_organization_id_fkey) - o singura
  // interogare, in stilul embed-urilor din features/*/queries.ts. `null` pentru
  // super_admin (organization_id null) sau daca organizatia nu a putut fi rezolvata.
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id, client_id, full_name, email, organizations(status)")
    .eq("id", user.id)
    .single();
  if (!profile) return null;

  return {
    id: user.id,
    email: profile.email ?? user.email ?? null,
    role: profile.role,
    organizationId: profile.organization_id,
    clientId: profile.client_id,
    fullName: profile.full_name,
    organizationStatus: profile.organizations?.status ?? null,
  };
}

/**
 * Cere un utilizator autentificat; altfel redirect la /login. Daca organizatia lui
 * a fost suspendata (guard T2.1), redirect la pagina dedicata — a doua linie de
 * aparare fata de middleware (`updateSession`), utila si pentru cod care apeleaza
 * direct `requireUser`/`requireRole` (server actions, pagini) fara sa treaca prin
 * verificarea din middleware pentru orice motiv. Pagina `/organizatie-suspendata`
 * insasi NU trebuie sa apeleze `requireUser` (ar cauza redirect catre ea insasi) —
 * foloseste `getCurrentUser` direct.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (isOrgSuspended(user)) redirect(SUSPENDED_ORG_PATH);
  return user;
}

/**
 * Cere unul dintre rolurile date; altfel redirect la dashboard-ul rolului propriu
 * (un utilizator autentificat nu vede ecranul gresit, dar nici nu ramane blocat).
 */
export async function requireRole(roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect(homePathForRole(user.role));
  return user;
}
