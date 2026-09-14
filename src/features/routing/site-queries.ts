import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { OrganizationSite } from "./site-types";

type OrganizationSiteRow = Database["public"]["Tables"]["organization_sites"]["Row"];

export function mapSite(row: OrganizationSiteRow): OrganizationSite {
  return {
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    address: row.address,
    lat: row.lat === null ? null : Number(row.lat),
    lng: row.lng === null ? null : Number(row.lng),
    geocodedAt: row.geocoded_at,
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

/** Punctele de plecare ale organizatiei curente (ecranul /setari/statii + selectorul din /livrari/nou). */
export async function listSites(): Promise<OrganizationSite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_sites")
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error("Nu am putut încărca punctele de plecare.");
  return (data ?? []).map(mapSite);
}

/** Punctul de plecare implicit al organizatiei, daca exista (folosit ca preselectie la planificarea livrarii). */
export async function getDefaultSite(): Promise<OrganizationSite | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_sites")
    .select("*")
    .eq("is_default", true)
    .maybeSingle();
  if (error) throw new Error("Nu am putut încărca punctul de plecare implicit.");
  return data ? mapSite(data) : null;
}

/** Un punct de plecare, dupa id (folosit la calculul rutei - vezi service.ts). */
export async function getSiteById(id: string): Promise<OrganizationSite | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organization_sites")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Nu am putut încărca punctul de plecare.");
  return data ? mapSite(data) : null;
}
