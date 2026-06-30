"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/session";

export interface SettingsState {
  error: string | null;
  message: string | null;
}

export const initialSettingsState: SettingsState = { error: null, message: null };

function clean(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

/** Actualizeaza brandingul / setarile organizatiei curente (doar admin, prin RLS). */
export async function updateOrganizationAction(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin" || !user.organizationId) {
    return { error: "Nu ai permisiunea de a modifica setarile organizatiei.", message: null };
  }

  const name = clean(formData.get("name"));
  if (!name) return { error: "Numele organizatiei este obligatoriu.", message: null };

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name,
      logo_url: clean(formData.get("logo_url")),
      primary_color: clean(formData.get("primary_color")),
      secondary_color: clean(formData.get("secondary_color")),
      custom_domain: clean(formData.get("custom_domain")),
      email_from_name: clean(formData.get("email_from_name")),
      email_from_address: clean(formData.get("email_from_address")),
    })
    .eq("id", user.organizationId);

  if (error) {
    // Cel mai probabil: custom_domain deja folosit de alta organizatie (unique).
    return {
      error: "Nu am putut salva setarile. Verifica daca domeniul nu e deja folosit.",
      message: null,
    };
  }

  // Tema/numele se reflecta in shell (sidebar) imediat.
  revalidatePath("/", "layout");
  return { error: null, message: "Setarile au fost salvate." };
}
