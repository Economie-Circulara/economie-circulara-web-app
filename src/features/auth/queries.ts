import { createClient } from "@/lib/supabase/server";
import { canSendFromOrgDomain } from "@/features/notifications/sender";
import { resolveModules, type ModuleKey } from "@/features/modules/modules";
import type { TenantHint } from "./tenant";

export interface OrgBranding {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  /** Logo orizontal (`organizations.logo_url`). */
  logoUrl: string | null;
  /** Logo patrat (`organizations.logo_square_url`, 0049). */
  logoSquareUrl: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  /** Cheia temei vizuale (`organizations.theme`, 0045). */
  theme: string;
}

export interface CurrentOrg extends OrgBranding {
  /** Organizarea meniului + panoului (`organizations.layout`, 0046). */
  layout: string;
  /** Modulele optionale active (`organizations.enabled_modules`, 0055). */
  enabledModules: ModuleKey[];
  emailFromName: string | null;
  emailFromAddress: string | null;
  /** Adresa de raspuns a emailurilor (0050) - o seteaza adminul organizatiei. */
  emailReplyTo: string | null;
  /** Adresa de pe care pleaca efectiv emailurile (domeniu verificat), altfel `null` = adresa platformei. */
  emailSendingAddress: string | null;
  /** Date de identificare fiscala (migrarea 0023) - afisate pe certificatul de trasabilitate. */
  cui: string | null;
  regCom: string | null;
  address: string | null;
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
      "id, name, slug, custom_domain, logo_url, logo_square_url, primary_color, secondary_color, theme, layout, enabled_modules, email_from_name, email_from_address, email_reply_to, email_domain, email_domain_status, cui, reg_com, address",
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
    logoSquareUrl: org.logo_square_url,
    primaryColor: org.primary_color,
    secondaryColor: org.secondary_color,
    theme: org.theme,
    layout: org.layout,
    enabledModules: resolveModules(org.enabled_modules),
    emailFromName: org.email_from_name,
    emailFromAddress: org.email_from_address,
    emailReplyTo: org.email_reply_to,
    emailSendingAddress: canSendFromOrgDomain({
      fromAddress: org.email_from_address,
      emailDomain: org.email_domain,
      emailDomainStatus: org.email_domain_status,
    })
      ? org.email_from_address
      : null,
    cui: org.cui,
    regCom: org.reg_com,
    address: org.address,
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
    logoSquareUrl: data.logo_square_url,
    primaryColor: data.primary_color,
    secondaryColor: data.secondary_color,
    theme: data.theme,
  };
}
