/**
 * Rezolvarea tenantului (organizatiei) dintr-o cerere HTTP.
 *
 * Platforma e multi-tenant cu izolare logica (RLS pe `organization_id`). O organizatie
 * e identificata printr-un `slug` (ex. "acme") care alimenteaza atat un subdomeniu
 * (`acme.<root>`) cat si un segment de path (`/<slug>/...`), plus un `custom_domain`
 * optional (white-label complet, ex. "trace.acme.ro").
 *
 * Acest modul e PUR (fara DB / fara Next): primeste host + pathname si decide ce slug
 * sau custom domain trebuie cautat in `organizations`. Lookup-ul efectiv + temele se
 * fac in stratul de date (vezi session.ts / middleware).
 */

/** Header prin care tenantul rezolvat e propagat downstream (server components, route handlers). */
export const TENANT_SLUG_HEADER = "x-tenant-slug";
/** Header prin care custom domain-ul rezolvat e propagat downstream. */
export const TENANT_DOMAIN_HEADER = "x-tenant-domain";

export type TenantSource = "custom_domain" | "subdomain" | "path" | "none";

export interface TenantHint {
  /** Slug-ul candidat (subdomeniu sau primul segment de path), normalizat lowercase. */
  slug: string | null;
  /** Host folosit ca posibil custom domain (cand nu e sub root domain). */
  customDomain: string | null;
  /** Cum a fost dedus tenantul (pentru debugging / precedenta de lookup). */
  source: TenantSource;
}

/** Cai care nu apartin niciunui tenant (auth, asset-uri, API platforma, rute aplicatie). */
const RESERVED_PATH_SEGMENTS = new Set([
  "api",
  "auth",
  "login",
  "_next",
  "favicon.ico",
  "static",
  "assets",
  "dashboard",
  "portal",
  "platform",
  "showcase",
  "set-password",
  "forgot-password",
  "organizatie-suspendata",
]);

/** Sub-domenii care nu reprezinta un tenant. */
const RESERVED_SUBDOMAINS = new Set(["www", "app", "admin", "api"]);

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** Elimina portul si forteaza lowercase dintr-un header Host. */
export function normalizeHost(host: string | null | undefined): string {
  if (!host) return "";
  return host.split(":")[0]!.trim().toLowerCase();
}

function isValidSlug(value: string): boolean {
  return SLUG_RE.test(value);
}

/**
 * Deduce tenantul dintr-un host + pathname, in ordinea de precedenta:
 *   1. custom domain  - host care NU e sub `rootDomain` (si nu e localhost/IP)
 *   2. subdomeniu     - prima eticheta din `<slug>.<rootDomain>`
 *   3. path           - primul segment `/<slug>/...`
 *
 * `rootDomain` vine din config (ex. NEXT_PUBLIC_ROOT_DOMAIN = "lateristrace.app").
 * In dev (localhost) nu exista subdomenii utile, deci se cade pe path.
 */
export function resolveTenant(
  host: string | null | undefined,
  pathname: string,
  rootDomain?: string | null,
): TenantHint {
  const normHost = normalizeHost(host);
  const root = normalizeHost(rootDomain);

  const isLocal =
    normHost === "" ||
    normHost === "localhost" ||
    normHost.endsWith(".localhost") ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(normHost);

  // 1 + 2: rezolvare pe baza de host (doar daca avem un root domain configurat).
  if (root && !isLocal) {
    if (normHost === root || normHost === `www.${root}`) {
      // Domeniul radacina al platformei - fara tenant din host; incearca path.
      return fromPath(pathname);
    }

    if (normHost.endsWith(`.${root}`)) {
      // Subdomeniu: eticheta dinaintea root-ului.
      const label = normHost.slice(0, normHost.length - root.length - 1);
      const firstLabel = label.split(".")[0]!;
      if (isValidSlug(firstLabel) && !RESERVED_SUBDOMAINS.has(firstLabel)) {
        return { slug: firstLabel, customDomain: null, source: "subdomain" };
      }
      return fromPath(pathname);
    }

    // Host strain de root domain => custom domain white-label.
    return { slug: null, customDomain: normHost, source: "custom_domain" };
  }

  // 3: fallback pe path (dev / lipsa root domain).
  return fromPath(pathname);
}

function fromPath(pathname: string): TenantHint {
  const first = pathname.split("/").filter(Boolean)[0];
  if (first && isValidSlug(first) && !RESERVED_PATH_SEGMENTS.has(first)) {
    return { slug: first, customDomain: null, source: "path" };
  }
  return { slug: null, customDomain: null, source: "none" };
}
