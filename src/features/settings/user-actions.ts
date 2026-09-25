"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOrganizationOrigin } from "@/features/auth/origin";
import { getCurrentUser } from "@/features/auth/session";
import { getClient } from "@/features/clients/queries";
import type { UserMgmtState } from "./action-state";
import { EMAIL_RE } from "./email";

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
  const origin = await getOrganizationOrigin(admin.organizationId);

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
 * Nucleul invitarii unui client, legat de o firma-client existenta din organizatie
 * (`profiles.client_id`). Regula de business: **un client = un singur utilizator**
 * - respins daca firma are deja un profil `client` asociat. Trimite email de
 * invitatie (Supabase) si creeaza profilul legat. Doar admin.
 *
 * Extras din `inviteClientAction` ca sa poata fi refolosit si de fluxul de creare
 * client cu invitare directa (vezi `createClientAction` in
 * src/features/clients/actions.ts) si de afordanta de invitare de pe
 * `/clienti/[id]` (vezi src/features/clients/invite-portal-access.tsx), nu doar de
 * formularul dedicat din /setari/utilizatori.
 */
export async function sendClientInvite(clientId: string, rawEmail: string): Promise<UserMgmtState> {
  const admin = await getCurrentUser();
  if (!admin || admin.role !== "admin" || !admin.organizationId) {
    return { error: "Nu ai permisiunea de a invita utilizatori.", message: null };
  }

  const email = rawEmail.trim().toLowerCase();
  const trimmedClientId = clientId.trim();

  if (!trimmedClientId) return { error: "Selecteaza firma-client.", message: null };
  if (!email) return { error: "Completeaza adresa de email.", message: null };
  if (!EMAIL_RE.test(email)) return { error: "Adresa de email nu este valida.", message: null };

  // Firma trebuie sa existe si sa apartina organizatiei adminului (RLS org-scoped
  // via clientul de sesiune - vezi clients_staff_all in 0001_core_schema.sql).
  const client = await getClient(trimmedClientId);
  if (!client) {
    return { error: "Firma selectata nu exista in organizatia ta.", message: null };
  }

  const adminClient = createAdminClient();

  // Un client = un singur utilizator: respinge daca firma are deja un profil
  // `client` legat. Verificarea de mai jos ramane utila pentru un mesaj de eroare
  // clar in UI; protectia definitiva vine din indexul unic partial
  // `profiles_client_id_unique` (0016_review_hardening.sql), care respinge orice
  // race condition intre doua invitatii simultane pentru aceeasi firma.
  const { data: existingProfile, error: existingError } = await adminClient
    .from("profiles")
    .select("id")
    .eq("client_id", trimmedClientId)
    .maybeSingle();
  if (existingError) {
    return { error: "Nu am putut verifica firma selectata. Incearca din nou.", message: null };
  }
  if (existingProfile) {
    return { error: "Aceasta firma are deja un utilizator client asociat.", message: null };
  }

  const origin = await getOrganizationOrigin(admin.organizationId);
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
    client_id: trimmedClientId,
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
  revalidatePath(`/clienti/${trimmedClientId}`);
  return { error: null, message: `Invitatie trimisa catre ${email}.` };
}

/**
 * Formular de invitare client din /setari/utilizatori - deleaga la `sendClientInvite`.
 */
export async function inviteClientAction(
  _prev: UserMgmtState,
  formData: FormData,
): Promise<UserMgmtState> {
  const email = String(formData.get("email") ?? "").trim();
  const clientId = String(formData.get("client_id") ?? "").trim();
  return sendClientInvite(clientId, email);
}
