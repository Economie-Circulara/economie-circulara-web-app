import { createClient } from "@/lib/supabase/server";
import { mapSite } from "./site-queries";
import type { OrganizationSite } from "./site-types";

export interface UpsertSiteInput {
  /** Omis -> creaza un punct de plecare nou; setat -> actualizeaza cel existent. */
  id?: string;
  organizationId: string;
  name: string;
  address: string;
  isDefault: boolean;
}

/**
 * Creeaza/actualizeaza un punct de plecare. Un singur implicit per organizatie -
 * acelasi pattern ca `upsertAddress` (`src/features/clients/service.ts`): cand
 * `isDefault` e true, orice alt punct marcat implicit e dezactivat INAINTE de
 * insert/update (doua interogari secventiale - staff, concurenta scazuta).
 */
export async function upsertSite(input: UpsertSiteInput): Promise<OrganizationSite> {
  const supabase = await createClient();

  if (input.isDefault) {
    let clearQuery = supabase
      .from("organization_sites")
      .update({ is_default: false })
      .eq("organization_id", input.organizationId)
      .eq("is_default", true);
    if (input.id) clearQuery = clearQuery.neq("id", input.id);

    const { error: clearError } = await clearQuery;
    if (clearError) throw new Error("Nu am putut actualiza punctul de plecare implicit existent.");
  }

  const payload = {
    organization_id: input.organizationId,
    name: input.name,
    address: input.address,
    is_default: input.isDefault,
  };

  const { data, error } = input.id
    ? await supabase.from("organization_sites").update(payload).eq("id", input.id).select().single()
    : await supabase.from("organization_sites").insert(payload).select().single();

  if (error || !data) throw new Error("Nu am putut salva punctul de plecare.");
  return mapSite(data);
}

/** Sterge un punct de plecare. */
export async function deleteSite(id: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("organization_sites").delete().eq("id", id);
  if (error) throw new Error("Nu am putut șterge punctul de plecare.");
}
