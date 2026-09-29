import { HOSTNAME_RE } from "./domain";

/**
 * Domeniul de email al unei organizatii (plan: docs/plans/email-white-label-per-domeniu.md)
 * - partea pura: validari si maparea raspunsurilor providerului (Resend).
 */
export const EMAIL_DOMAIN_STATUSES = ["not_configured", "pending", "verified", "failed"] as const;
export type EmailDomainStatus = (typeof EMAIL_DOMAIN_STATUSES)[number];

/** O inregistrare DNS ceruta de provider, in forma salvata in `email_domain_records`. */
export interface EmailDnsRecord {
  type: string;
  /** Numele, asa cum il da providerul (relativ la zona DNS, ex. `send`, `resend._domainkey`). */
  name: string;
  value: string;
  priority: number | null;
  status: string;
}

export const EMAIL_DOMAIN_STATUS_LABELS: Record<EmailDomainStatus, string> = {
  not_configured: "Neconfigurat",
  pending: "In asteptare (DNS neverificat)",
  verified: "Verificat",
  failed: "Verificare esuata",
};

export function resolveEmailDomainStatus(value: string | null | undefined): EmailDomainStatus {
  return (EMAIL_DOMAIN_STATUSES as readonly string[]).includes(value ?? "")
    ? (value as EmailDomainStatus)
    : "not_configured";
}

/**
 * Statusul Resend -> statusul nostru: `verified` si `failed` se pastreaza, orice alta
 * stare (`not_started`, `pending`, `temporary_failure`, `partially_verified` ...)
 * inseamna ca trebuie asteptat / reverificat.
 */
export function mapProviderStatus(status: string | null | undefined): EmailDomainStatus {
  if (status === "verified") return "verified";
  if (status === "failed") return "failed";
  return "pending";
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** Domeniul de trimitere: doar hostul, lowercase (ex. `etora.ro`); gol = fara domeniu. */
export function normalizeEmailDomain(
  raw: string | null | undefined,
): ValidationResult<string | null> {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^.*@/, "")
    .replace(/\/+$/, "");
  if (!value) return { ok: true, value: null };
  if (!HOSTNAME_RE.test(value)) {
    return { ok: false, error: "Domeniu de email invalid: doar domeniul, ex. firma.ro." };
  }
  return { ok: true, value };
}

const LOCAL_PART_RE = /^[a-z0-9](?:[a-z0-9._+-]{0,62}[a-z0-9])?$/;

/** Partea din fata lui `@` a adresei expeditorului (implicit `notificari`). */
export function normalizeLocalPart(raw: string | null | undefined): ValidationResult<string> {
  const value = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/@.*$/, "");
  if (!value) return { ok: true, value: "notificari" };
  if (!LOCAL_PART_RE.test(value) || value.includes("..")) {
    return { ok: false, error: "Adresa expeditorului invalida: doar litere, cifre, . _ + -." };
  }
  return { ok: true, value };
}

/** Partea locala a unei adrese existente (pentru formular). */
export function localPartOf(address: string | null | undefined): string {
  const at = address?.lastIndexOf("@") ?? -1;
  return at > 0 ? address!.slice(0, at) : "notificari";
}

/** Inregistrarile salvate (jsonb) -> lista tipata; ignora ce nu are forma asteptata. */
export function parseStoredRecords(value: unknown): EmailDnsRecord[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const r = item as Partial<EmailDnsRecord> | null;
    if (
      !r ||
      typeof r.type !== "string" ||
      typeof r.name !== "string" ||
      typeof r.value !== "string"
    ) {
      return [];
    }
    return [
      {
        type: r.type,
        name: r.name,
        value: r.value,
        priority: typeof r.priority === "number" ? r.priority : null,
        status: typeof r.status === "string" ? r.status : "",
      },
    ];
  });
}
