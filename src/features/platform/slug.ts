/**
 * Validare slug organizatie — TREBUIE sa ramana identica cu constraint-ul din
 * schema (supabase/migrations/0001_core_schema.sql, `organizations_slug_format`)
 * si cu regexul folosit la rezolvarea tenantului (src/features/auth/tenant.ts).
 * Litere mici, cifre si cratime; fara cratima la inceput/sfarsit.
 */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

export function isValidSlug(value: string): boolean {
  return SLUG_RE.test(value);
}

/**
 * Sugestie de slug pornind de la numele organizatiei (diacritice eliminate,
 * spatii -> cratima). Doar UX (pre-completare) — validarea reala e `isValidSlug`.
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
