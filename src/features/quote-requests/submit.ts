import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { ORG_EMAIL_COLUMNS, emailBrandFor } from "@/features/notifications/email-brand";
import type { EmailProvider } from "@/features/notifications/provider";
import { quoteRecipients, renderQuoteRequestEmail } from "./email";
import { isAllowedOrigin, normalizeHost, parseQuoteRequest } from "./request";

/**
 * Logica endpoint-ului public `POST /api/public/cerere-oferta` (plan:
 * docs/plans/site-cerere-oferta.md), separata de ruta ca sa fie testabila cu
 * dependentele mock-uite. Ordinea: origine -> parsare -> RPC (salvare + anti-spam) ->
 * email. Emailul e best-effort: cererea e deja in aplicatie (`/cereri-oferta`).
 */

export interface QuoteSubmission {
  host: string | null;
  origin: string | null;
  ip: string | null;
  body: unknown;
}

export interface QuoteDeps {
  admin: SupabaseClient<Database>;
  provider: EmailProvider;
  allowLocalOrigins: boolean;
  ipSalt: string;
}

export interface QuoteResult {
  status: number;
  body: { ok: true } | { ok: false; error: string };
}

/** Hash-ul IP-ului (cu sare): suficient pentru limita pe IP, fara IP-ul in clar in DB. */
export function hashIp(ip: string | null, salt: string): string | null {
  const value = ip?.split(",")[0]?.trim();
  if (!value) return null;
  return createHash("sha256").update(`${salt}:${value}`).digest("hex");
}

const RATE_LIMIT_CODES = new Set(["QR002", "QR003"]);

export async function submitQuoteRequest(
  input: QuoteSubmission,
  deps: QuoteDeps,
): Promise<QuoteResult> {
  const host = normalizeHost(input.host);
  if (!host || !isAllowedOrigin(input.origin, host, deps.allowLocalOrigins)) {
    return { status: 403, body: { ok: false, error: "Originea cererii nu este permisă." } };
  }

  const parsed = parseQuoteRequest(input.body);
  // Botului ii raspundem ca si cum ar fi reusit - sa nu invete sa ocoleasca capcana.
  if (parsed.kind === "bot") return { status: 200, body: { ok: true } };
  if (parsed.kind === "invalid") return { status: 400, body: { ok: false, error: parsed.error } };
  const request = parsed.value;

  const { error } = await deps.admin.rpc("submit_quote_request", {
    p_domain: host,
    p_service: request.service,
    p_name: request.name,
    p_phone: request.phone,
    p_email: request.email ?? undefined,
    p_message: request.message ?? undefined,
    p_ip_hash: hashIp(input.ip, deps.ipSalt) ?? undefined,
  });
  if (error) {
    if (error.code && RATE_LIMIT_CODES.has(error.code)) {
      return {
        status: 429,
        body: { ok: false, error: "Ați trimis prea multe cereri. Încercați mai târziu." },
      };
    }
    if (error.code === "QR001") {
      return { status: 404, body: { ok: false, error: "Formularul nu este activ." } };
    }
    if (error.code === "QR004") {
      return { status: 400, body: { ok: false, error: "Date invalide în cerere." } };
    }
    console.error("[cerere-oferta] salvare esuata", { code: error.code, message: error.message });
    return {
      status: 500,
      body: { ok: false, error: "Nu am putut trimite cererea. Încercați din nou." },
    };
  }

  try {
    await notifyOrganization(host, request, deps);
  } catch (err) {
    // Fara date personale in log - cererea e salvata, staff-ul o vede in aplicatie.
    console.error("[cerere-oferta] email esuat", {
      name: err instanceof Error ? err.name : "unknown",
      message: err instanceof Error ? err.message : null,
    });
  }

  return { status: 200, body: { ok: true } };
}

async function notifyOrganization(
  host: string,
  request: Parameters<typeof renderQuoteRequestEmail>[1],
  deps: QuoteDeps,
): Promise<void> {
  const { data: org, error } = await deps.admin
    .from("organizations")
    .select(`id, ${ORG_EMAIL_COLUMNS}`)
    .eq("custom_domain", host)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!org) return;

  const { data: admins, error: adminsError } = await deps.admin
    .from("profiles")
    .select("email")
    .eq("organization_id", org.id)
    .eq("role", "admin")
    .eq("status", "active");
  if (adminsError) throw new Error(adminsError.message);

  const recipients = quoteRecipients(
    org.email_reply_to,
    (admins ?? []).map((a) => a.email),
  );
  if (recipients.length === 0) return;

  const brand = emailBrandFor(org);
  const listUrl = brand.customOrigin ? `${brand.customOrigin}/cereri-oferta` : null;
  const rendered = renderQuoteRequestEmail(brand, request, listUrl);
  for (const to of recipients) {
    await deps.provider.send({
      to,
      from: brand.from,
      // Raspunsul firmei merge direct la solicitant, daca si-a lasat emailul.
      replyTo: request.email ?? brand.replyTo,
      ...rendered,
    });
  }
}
