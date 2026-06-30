"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, homePathForRole } from "./session";
import type { AuthState } from "./form-state";

async function siteOrigin(): Promise<string> {
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}

function readEmail(formData: FormData): string {
  return String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
}

/** Login email + parola. La succes redirecteaza la dashboard-ul rolului. */
export async function signInWithPasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Completeaza adresa de email si parola.", message: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: "Email sau parola incorecte.", message: null };
  }

  const user = await getCurrentUser();
  redirect(user ? homePathForRole(user.role) : "/");
}

/** Login fara parola: trimite un magic link pe email. */
export async function signInWithMagicLinkAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readEmail(formData);
  if (!email) return { error: "Completeaza adresa de email.", message: null };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false, // doar utilizatori existenti (invitati de admin)
      emailRedirectTo: `${await siteOrigin()}/auth/callback`,
    },
  });
  if (error) {
    return { error: "Nu am putut trimite link-ul. Incearca din nou.", message: null };
  }
  return { error: null, message: "Ti-am trimis un link de autentificare pe email." };
}

/** Login cu Google (OAuth). Redirecteaza catre fluxul Google. */
export async function signInWithGoogleAction(): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error || !data?.url) redirect("/login?error=oauth");
  redirect(data.url);
}

/** Cerere de resetare parola: trimite email cu link catre /set-password. */
export async function requestPasswordResetAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = readEmail(formData);
  if (!email) return { error: "Completeaza adresa de email.", message: null };

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await siteOrigin()}/auth/callback?next=/set-password`,
  });
  // Mesaj neutru (nu dezvaluim daca emailul exista).
  return {
    error: null,
    message: "Daca exista un cont cu acest email, vei primi instructiuni de resetare.",
  };
}

/** Seteaza o parola noua (dupa invitatie sau resetare). Necesita sesiune activa. */
export async function updatePasswordAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 8) {
    return { error: "Parola trebuie sa aiba minim 8 caractere.", message: null };
  }
  if (password !== confirm) {
    return { error: "Parolele nu coincid.", message: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Link expirat sau invalid. Cere un link nou.", message: null };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: "Nu am putut seta parola. Incearca din nou.", message: null };
  }

  const current = await getCurrentUser();
  redirect(current ? homePathForRole(current.role) : "/");
}

/** Delogare. */
export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
