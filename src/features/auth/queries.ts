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
