"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/features/auth/session";
import { setAuthUsersBanned } from "./auth-ban";
import { deactivationError } from "./deactivation";

/** Rezultatul (re)activarii unui cont (dialogul de confirmare). */
export interface DeactivationResult {
  error: string | null;
}

/**
 * Nucleul dezactivarii/reactivarii unui cont de staff (migrarea 0035). Utilizatorii
 * NU se sterg (sunt autori in audit - `stock_events.created_by`, `orders.created_by`
 * etc.), doar `profiles.status` trece pe `suspended`/`active`. Verificarile de
 * business sunt in `deactivationError`; RLS (`profiles_update` -> admin) + trigger-ul
 * `US001` (nu pe sine) sunt a doua linie. Ban-ul in Supabase Auth e best-effort.
 */
async function setUserActive(userId: string, active: boolean): Promise<DeactivationResult> {
  const actor = await getCurrentUser();
  if (!actor) return { error: "Nu ești autentificat." };
  if (!userId) return { error: "Utilizator invalid." };

  const supabase = await createClient();
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, role, organization_id")
    .eq("id", userId)
    .maybeSingle();
  if (targetError) return { error: "Nu am putut încărca utilizatorul." };
  if (!target) return { error: "Utilizatorul nu există sau nu ai acces la el." };

  const ruleError = deactivationError(
    { id: actor.id, role: actor.role, organizationId: actor.organizationId },
    { id: target.id, role: target.role, organizationId: target.organization_id },
  );
  if (ruleError) return { error: ruleError };

  // `.select()` - un UPDATE blocat de RLS nu da eroare, doar 0 randuri afectate.
  const { data: updated, error: updateError } = await supabase
    .from("profiles")
    .update({ status: active ? "active" : "suspended" })
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (updateError || !updated) {
    return {
      error: active ? "Nu am putut reactiva contul." : "Nu am putut dezactiva contul.",
    };
  }

  await setAuthUsersBanned([userId], !active);

  revalidatePath("/setari/utilizatori");
  return { error: null };
}

/** Dezactiveaza un cont de staff - doar admin, nu pe sine (legat cu `.bind(null, id)`). */
export async function deactivateUserAction(userId: string): Promise<DeactivationResult> {
  return setUserActive(userId, false);
}

/** Reactiveaza un cont de staff dezactivat - doar admin. */
export async function reactivateUserAction(userId: string): Promise<DeactivationResult> {
  return setUserActive(userId, true);
}
