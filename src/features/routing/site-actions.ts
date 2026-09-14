"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/features/auth/session";
import type { SiteFormState } from "./site-action-state";
import { deleteSite, upsertSite } from "./site-service";

function clean(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

function checkbox(value: FormDataEntryValue | null): boolean {
  return value === "on" || value === "true";
}

/**
 * Creeaza/actualizeaza un punct de plecare (ecranul /setari/statii) - doar admin
 * (sectiunea Setari e admin-only in tot restul aplicatiei - vezi settings/actions.ts).
 * Punctele de plecare raman totusi VIZIBILE/SELECTABILE de operator la planificarea
 * unei livrari (RLS `organization_sites_staff_all` permite staff, nu doar admin).
 */
export async function upsertSiteAction(
  _prev: SiteFormState,
  formData: FormData,
): Promise<SiteFormState> {
  const user = await requireRole(["admin"]);
  if (!user.organizationId) return { error: "Utilizatorul curent nu are o organizație asociată." };

  const name = clean(formData.get("name"));
  const address = clean(formData.get("address"));
  if (!name) return { error: "Numele este obligatoriu." };
  if (!address) return { error: "Adresa este obligatorie." };

  try {
    await upsertSite({
      id: clean(formData.get("id")) ?? undefined,
      organizationId: user.organizationId,
      name,
      address,
      isDefault: checkbox(formData.get("is_default")),
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut salva punctul de plecare." };
  }

  revalidatePath("/setari/statii");
  return { error: null };
}

/** Sterge un punct de plecare - doar admin. */
export async function deleteSiteAction(
  _prev: SiteFormState,
  formData: FormData,
): Promise<SiteFormState> {
  await requireRole(["admin"]);
  const id = clean(formData.get("id"));
  if (!id) return { error: "Punct de plecare invalid." };

  try {
    await deleteSite(id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut șterge punctul de plecare." };
  }

  revalidatePath("/setari/statii");
  return { error: null };
}
