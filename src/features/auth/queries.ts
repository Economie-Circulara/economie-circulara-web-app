import { createClient } from "@/lib/supabase/server";
import type { TenantHint } from "./tenant";

export interface OrgBranding {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  logoUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

export interface CurrentOrg extends OrgBranding {
  emailFromName: string | null;
  emailFromAddress: string | null;
}

/**
 * Organizatia utilizatorului curent (pentru shell + ecranul de setari). RLS permite
 * oricarui membru sa-si citeasca propria organizatie. `null` pentru super-admin fara
 * organizatie sau cand nu exista sesiune.
 */
export async function getCurrentOrg(): Promise<CurrentOrg | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id")
    .eq("id", user.id)
    .single();
  if (!profile?.organization_id) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select(
      "id, name, slug, custom_domain, logo_url, primary_color, secondary_color, email_from_name, email_from_address",
    )
    .eq("id", profile.organization_id)
    .single();
  if (!org) return null;

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    customDomain: org.custom_domain,
    logoUrl: org.logo_url,
    primaryColor: org.primary_color,
    secondaryColor: org.secondary_color,
    emailFromName: org.email_from_name,
    emailFromAddress: org.email_from_address,
  };
}

/**
 * Brandingul organizatiei pentru ecranul de login (callabil si neautentificat, prin
 * functia SECURITY DEFINER `public.org_branding`). Returneaza `null` daca tenantul nu
 * e cunoscut (se afiseaza brandingul implicit al platformei).
 */
export async function getOrgBranding(hint: TenantHint): Promise<OrgBranding | null> {
  if (!hint.slug && !hint.customDomain) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("org_branding", {
      p_slug: hint.slug ?? undefined,
      p_domain: hint.customDomain ?? undefined,
    })
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    customDomain: data.custom_domain,
    logoUrl: data.logo_url,
    primaryColor: data.primary_color,
    secondaryColor: data.secondary_color,
  };
}
