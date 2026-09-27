/**
 * Validarea domeniului propriu al unei organizatii (`organizations.custom_domain`),
 * setat de super-admin in /platform. Se stocheaza DOAR hostul, lowercase - exact forma
 * comparata de garda de domeniu (`tenantDomainRedirect`) si de `org_branding`.
 */
export type CustomDomainResult = { ok: true; value: string | null } | { ok: false; error: string };

const HOSTNAME_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normalizeCustomDomain(raw: string | null | undefined): CustomDomainResult {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  if (!value) return { ok: true, value: null };
  if (!HOSTNAME_RE.test(value)) {
    return {
      ok: false,
      error: "Domeniu invalid: doar hostul, fara cale sau port (ex. app.firma.ro).",
    };
  }
  return { ok: true, value };
}
