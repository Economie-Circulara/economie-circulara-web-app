import { PLATFORM_NAME } from "@/lib/brand";

/**
 * Profilul unui tenant = ce difera in ORGANIZAREA aplicatiei intre organizatii
 * (plan: docs/plans/multi-domain-tenant-profiles.md, T3/T4). Aspectul vizual (culori,
 * font, colturi, ...) NU sta aici - vine din tema organizatiei (T5).
 *
 * Profilurile sunt hardcodate in cod, cu cheie pe `organizations.slug`: sunt putine,
 * se schimba rar si trebuie review-uite ca orice alt cod. O organizatie fara profil
 * primeste `DEFAULT_PROFILE` (comportamentul de pana acum).
 */
export interface TenantProfile {
  /**
   * Numele aplicatiei afisat pe domeniul organizatiei (titluri, PDF-uri, asistent,
   * manual). Lipsa -> numele organizatiei (daca are domeniu propriu) sau numele
   * platformei.
   */
  productName?: string;
  /** Subtitlul de sub numele organizatiei in antetul PDF-urilor. */
  documentTagline?: string;
  /** Nota din subsolul PDF-urilor (ex. date de contact); lipsa = fara nota. */
  documentFooterNote?: string;
}

/** Subtitlul implicit din antetul PDF-urilor (textul folosit pana acum). */
export const DEFAULT_DOCUMENT_TAGLINE = "Materiale de construcții circulare";

export const DEFAULT_PROFILE: TenantProfile = {};

/** Profilurile per organizatie (cheie: `organizations.slug`). */
const TENANT_PROFILES: Record<string, TenantProfile> = {};

export function getTenantProfile(
  slug: string | null | undefined,
  profiles: Record<string, TenantProfile> = TENANT_PROFILES,
): TenantProfile {
  return (slug && profiles[slug]) || DEFAULT_PROFILE;
}

/** Ce trebuie stiut despre organizatie ca sa-i rezolvam numele de produs. */
export interface ProductNameOrg {
  slug: string;
  name: string;
  customDomain: string | null;
}

/**
 * Numele aplicatiei pentru o organizatie:
 *  1. `productName` din profil, daca exista;
 *  2. numele organizatiei, daca are domeniu propriu - pe domeniul unui tenant
 *     „Lot cu Lot” nu apare (decizie 2026-09-25);
 *  3. altfel numele platformei (organizatiile gazduite pe domeniul platformei, sau
 *     niciun tenant - ex. super-admin, pagina publica).
 */
export function productNameFor(
  org: ProductNameOrg | null | undefined,
  profiles?: Record<string, TenantProfile>,
): string {
  if (!org) return PLATFORM_NAME;
  const profile = getTenantProfile(org.slug, profiles);
  if (profile.productName) return profile.productName;
  return org.customDomain ? org.name : PLATFORM_NAME;
}

/**
 * Creditul „emis de <X>” din subsolul documentelor: numele produsului, dar DOAR daca
 * difera de numele organizatiei (altfel ar suna „Firma A · emis de Firma A”).
 */
export function issuerCreditFor(
  org: ProductNameOrg | null | undefined,
  profiles?: Record<string, TenantProfile>,
): string | null {
  const productName = productNameFor(org, profiles);
  return org && productName === org.name ? null : productName;
}
