"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/features/auth/session";
import { getClient } from "@/features/clients/queries";
import type { UserMgmtState } from "./form-state";

/** Validare minimala de format email (server-side; input-ul HTML e `type="email"`). */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

/**
 * Invita un membru de staff (operator sau alt admin) in organizatia curenta. Trimite
 * email de invitatie (Supabase) si creeaza profilul legat de organizatie. Doar admin.
 */
export async function inviteStaffAction(
  _prev: UserMgmtState,
  formData: FormData,
): Promise<UserMgmtState> {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin" || !admin.organizationId) {
    return { error: "Nu ai permisiunea de a invita utilizatori.", message: null };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const fullName = String(formData.get("full_name") ?? "").trim() || null;
  const role = String(formData.get("role") ?? "");
  if (!email) return { error: "Completeaza adresa de email.", message: null };
  if (role !== "operator" && role !== "admin") {
    return { error: "Rol invalid.", message: null };
  }

  const adminClient = createAdminClient();
  const origin = await siteOrigin();

  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/set-password`,
  });
  if (error || !data?.user) {
    return { error: "Nu am putut trimite invitatia (poate exista deja un cont).", message: null };
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: data.user.id,
    organization_id: admin.organizationId,
    role,
    full_name: fullName,
    email,
  });
  if (profileError) {
    return {
      error: "Contul a fost creat, dar profilul nu a putut fi salvat. Contacteaza suport.",
      message: null,
    };
  }

  revalidatePath("/setari/utilizatori");
  return { error: null, message: `Invitatie trimisa catre ${email}.` };
}

/**
 * Invita un utilizator cu rol `client`, legat de o firma-client existenta din
 * organizatie (`profiles.client_id`). Regula de business: **un client = un singur
 * utilizator** — respins daca firma are deja un profil `client` asociat. Trimite
 * email de invitatie (Supabase) si creeaza profilul legat. Doar admin.
 */
export async function inviteClientAction(
  _prev: UserMgmtState,
  formData: FormData,
): Promise<UserMgmtState> {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin" || !admin.organizationId) {
    return { error: "Nu ai permisiunea de a invita utilizatori.", message: null };
  }

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const clientId = String(formData.get("client_id") ?? "").trim();

  if (!clientId) return { error: "Selecteaza firma-client.", message: null };
  if (!email) return { error: "Completeaza adresa de email.", message: null };
  if (!EMAIL_RE.test(email)) return { error: "Adresa de email nu este valida.", message: null };

  // Firma trebuie sa existe si sa apartina organizatiei adminului (RLS org-scoped
  // via clientul de sesiune — vezi clients_staff_all in 0001_core_schema.sql).
  const client = await getClient(clientId);
  if (!client) {
    return { error: "Firma selectata nu exista in organizatia ta.", message: null };
  }

  const adminClient = createAdminClient();

  // Un client = un singur utilizator: respinge daca firma are deja un profil
  // `client` legat. Nota: fara un unique index pe profiles.client_id la nivel de
  // DB (necesita migrare, in afara scope-ului acestui task), verificarea de mai
  // jos are o fereastra teoretica de race condition intre doua invitatii
  // simultane pentru aceeasi firma — limitare cunoscuta, documentata in
  // docs/plans/fix-f7a-invitare-client.md si AGENTS.md §4.1.
  const { data: existingProfile, error: existingError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("client_id", clientId)
    .maybeSingle();
  if (existingError) {
    return { error: "Nu am putut verifica firma selectata. Incearca din nou.", message: null };
  }
  if (existingProfile) {
    return { error: "Aceasta firma are deja un utilizator client asociat.", message: null };
  }

  const origin = await siteOrigin();
  const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/set-password`,
  });
  if (error || !data?.user) {
    return { error: "Nu am putut trimite invitatia (poate exista deja un cont).", message: null };
  }

  const { error: profileError } = await adminClient.from("profiles").insert({
    id: data.user.id,
    organization_id: admin.organizationId,
    role: "client",
    client_id: clientId,
    full_name: client.contactPerson,
    email,
  });
  if (profileError) {
    return {
      error: "Contul a fost creat, dar profilul nu a putut fi salvat. Contacteaza suport.",
      message: null,
    };
  }

  revalidatePath("/setari/utilizatori");
  return { error: null, message: `Invitatie trimisa catre ${email}.` };
}
