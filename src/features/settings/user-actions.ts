"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/features/auth/session";

export interface UserMgmtState {
  error: string | null;
  message: string | null;
}

export const initialUserMgmtState: UserMgmtState = { error: null, message: null };

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
