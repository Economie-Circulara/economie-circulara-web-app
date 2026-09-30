/**
 * Cererea de oferta trimisa din site-ul de prezentare (plan:
 * docs/plans/site-cerere-oferta.md): parsarea corpului JSON si originile de pe care
 * endpoint-ul public accepta cereri. Pur - fara DB, fara retea.
 */

export interface QuoteRequestInput {
  service: string;
  name: string;
  phone: string;
  email: string | null;
  message: string | null;
}

export type ParsedQuoteRequest =
  | { kind: "ok"; value: QuoteRequestInput }
  /** Campul-capcana (invizibil pentru oameni) a fost completat: bot. */
  | { kind: "bot" }
  | { kind: "invalid"; error: string };

/** Limitele sunt aceleasi ca in RPC-ul `submit_quote_request` (0052). */
export const QUOTE_LIMITS = {
  service: 100,
  name: 120,
  phone: 40,
  email: 200,
  message: 2000,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+\d][\d\s().-]{5,}$/;

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function parseQuoteRequest(raw: unknown): ParsedQuoteRequest {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { kind: "invalid", error: "Cerere invalidă." };
  }
  const body = raw as Record<string, unknown>;

  if (text(body.website) !== "") return { kind: "bot" };

  const service = text(body.service);
  const name = text(body.name);
  const phone = text(body.phone);
  const email = text(body.email);
  const message = text(body.message);

  if (!service || !name || !phone) {
    return { kind: "invalid", error: "Completați serviciul, numele și telefonul." };
  }
  if (body.consent !== true) {
    return { kind: "invalid", error: "Este nevoie de acordul pentru prelucrarea datelor." };
  }
  if (!PHONE_RE.test(phone)) return { kind: "invalid", error: "Numărul de telefon nu este valid." };
  if (email && !EMAIL_RE.test(email)) {
    return { kind: "invalid", error: "Adresa de email nu este validă." };
  }
  if (
    service.length > QUOTE_LIMITS.service ||
    name.length > QUOTE_LIMITS.name ||
    phone.length > QUOTE_LIMITS.phone ||
    email.length > QUOTE_LIMITS.email ||
    message.length > QUOTE_LIMITS.message
  ) {
    return { kind: "invalid", error: "Unul dintre câmpuri este prea lung." };
  }

  return {
    kind: "ok",
    value: { service, name, phone, email: email || null, message: message || null },
  };
}

/** Hostul cererii, fara port, lowercase (`Host: abonamente.maconxcx.ro:443`). */
export function normalizeHost(host: string | null | undefined): string | null {
  const value = host?.trim().toLowerCase().replace(/:\d+$/, "");
  return value ? value : null;
}

/**
 * Originile site-ului de prezentare pentru domeniul aplicatiei: apex-ul (domeniul fara
 * primul subdomeniu) si `www.` - `abonamente.maconxcx.ro` -> `https://maconxcx.ro`,
 * `https://www.maconxcx.ro` (docs/setup.md 3.1). Un domeniu cu doar doua etichete nu
 * are apex separat -> lista goala.
 */
export function siteOriginsFor(appHost: string): string[] {
  const labels = appHost.split(".");
  if (labels.length < 3) return [];
  const apex = labels.slice(1).join(".");
  return [`https://${apex}`, `https://www.${apex}`];
}

const LOCAL_ORIGIN_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/**
 * Originea (browserul) are voie sa trimita cererea? CORS nu e o protectie de
 * securitate (un script o ignora) - doar impiedica alte site-uri sa foloseasca
 * formularul din browserul vizitatorilor lor. Protectia reala: validarea + limita din
 * RPC. In afara productiei acceptam si `localhost` (site-ul in `pnpm dev`).
 */
export function isAllowedOrigin(
  origin: string | null | undefined,
  appHost: string,
  allowLocal: boolean,
): boolean {
  if (!origin) return false;
  if (allowLocal && LOCAL_ORIGIN_RE.test(origin)) return true;
  return siteOriginsFor(appHost).includes(origin.toLowerCase());
}
