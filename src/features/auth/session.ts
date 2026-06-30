import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type UserRole = Database["public"]["Enums"]["user_role"];

export interface SessionUser {
  id: string;
  email: string | null;
  role: UserRole;
  organizationId: string | null;
  clientId: string | null;
  fullName: string | null;
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, organization_id, client_id, full_name, email")
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
  };
}

/** Cere un utilizator autentificat; altfel redirect la /login. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
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
