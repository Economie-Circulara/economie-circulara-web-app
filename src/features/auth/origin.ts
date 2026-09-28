import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSiteOrigin, orgOrigin } from "@/lib/site-url";
import { normalizeHost } from "./tenant";

/**
 * Originile folosite in linkurile de autentificare si invitatie, per organizatie
 * (plan: docs/plans/multi-domain-tenant-profiles.md, T1). Fiecare tenant cu
 * `organizations.custom_domain` isi primeste linkurile pe domeniul propriu; restul cad
 * pe originea canonica (`NEXT_PUBLIC_SITE_URL`).
 *
 * Lookup-urile folosesc clientul admin (service role): ruleaza fie inainte de login
 * (magic link, fara sesiune), fie pentru o organizatie TINTA diferita de a celui care
 * face cererea (super-adminul invita adminul unei organizatii). Orice esec de lookup
 * cade pe originea canonica - un link pe domeniul platformei e preferabil unui email
 * netrimis.
 */

/** Domeniul organizatiei `organizationId` (invitatii) sau originea canonica. */
export async function getOrganizationOrigin(organizationId: string): Promise<string> {
  const fallback = await getSiteOrigin();
  try {
    const { data } = await createAdminClient()
      .from("organizations")
      .select("custom_domain")
      .eq("id", organizationId)
      .maybeSingle();
    return orgOrigin(data?.custom_domain, fallback);
  } catch {
    return fallback;
  }
}

/**
 * Domeniul organizatiei careia ii apartine `email` (magic link). Raspunsul catre
 * browser nu depinde de rezultat, deci lookup-ul nu dezvaluie daca emailul exista.
 * Userii fara organizatie (super-admin) sau necunoscuti primesc originea cererii.
 */
export async function getOriginForEmail(email: string): Promise<string> {
  try {
    const { data } = await createAdminClient()
      .from("profiles")
      .select("organizations!profiles_organization_id_fkey(custom_domain)")
      .eq("email", email)
      .maybeSingle();
    const customDomain = data?.organizations?.custom_domain;
    if (customDomain) return orgOrigin(customDomain, await getSiteOrigin());
  } catch {
    // cade pe originea cererii
  }
  return getRequestTenantOrigin();
}

/**
 * Hostul cererii curente, DOAR daca e `custom_domain`-ul unei organizatii active;
 * altfel originea canonica. Folosit de fluxurile PKCE (OAuth, resetare parola), al
 * caror cookie verifier traieste pe hostul care a initiat cererea - callback-ul
 * trebuie sa revina pe acelasi host. Validarea contra DB impiedica un header Host
 * arbitrar sa ajunga in `redirectTo`.
 */
export async function getRequestTenantOrigin(): Promise<string> {
  const fallback = await getSiteOrigin();
  const h = await headers();
  const host = normalizeHost(h.get("x-forwarded-host") ?? h.get("host"));
  if (!host) return fallback;

  try {
    const { data } = await createAdminClient()
      .from("organizations")
      .select("custom_domain")
      .eq("custom_domain", host)
      .eq("status", "active")
      .maybeSingle();
    return orgOrigin(data?.custom_domain, fallback);
  } catch {
    return fallback;
  }
}
