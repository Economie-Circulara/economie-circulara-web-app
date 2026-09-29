import { createAdminClient } from "@/lib/supabase/admin";
import { ORG_EMAIL_COLUMNS, emailBrandFor, type OrgEmailRow } from "./email-brand";
import { renderAuthEmail, isAuthEmailAction, type AuthEmailAction } from "./auth-templates";
import { getEmailProvider, type EmailProvider } from "./provider";

/**
 * Supabase Auth „Send Email Hook” (plan: docs/plans/email-white-label-per-domeniu.md):
 * Supabase nu mai trimite singur emailurile de autentificare (invitatie, magic link,
 * resetare parola ...), ci ne trimite datele lor. Noi rezolvam organizatia userului si
 * trimitem emailul cu brandul + expeditorul ei - un singur proiect Supabase, cate un
 * domeniu de email per organizatie.
 */
export interface SendEmailHookPayload {
  user: {
    id: string;
    email?: string | null;
    new_email?: string | null;
    user_metadata?: Record<string, unknown> | null;
  };
  email_data: {
    token?: string | null;
    token_hash?: string | null;
    redirect_to?: string | null;
    email_action_type: string;
    site_url?: string | null;
    token_new?: string | null;
    token_hash_new?: string | null;
  };
}

/** Payload invalid (lipsesc campuri esentiale / tip de email necunoscut). */
export class InvalidHookPayloadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidHookPayloadError";
  }
}

export function parseSendEmailHookPayload(raw: unknown): SendEmailHookPayload {
  const value = raw as Partial<SendEmailHookPayload> | null;
  if (!value?.user?.id || !value.email_data?.email_action_type) {
    throw new InvalidHookPayloadError("Payload incomplet (user / email_data).");
  }
  return value as SendEmailHookPayload;
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Linkul din email: `redirect_to` (deja validat de Supabase fata de lista de Redirect
 * URLs) + `token_hash` + `type`, verificat de `/auth/callback` cu `verifyOtp` - acelasi
 * tipar ca template-ul de Magic Link documentat in docs/setup.md. Parametrii existenti
 * (ex. `next=/set-password`) raman. Cand organizatia are domeniu propriu, originea se
 * muta pe el: linkul ajunge pe domeniul userului indiferent de unde s-a facut cererea.
 */
export function buildAuthLink(input: {
  redirectTo?: string | null;
  siteUrl?: string | null;
  tokenHash: string;
  type: string;
  orgOrigin?: string | null;
}): string | null {
  let url: URL;
  try {
    url = new URL(input.redirectTo || input.siteUrl || "");
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.pathname === "/" || url.pathname === "") url.pathname = "/auth/callback";
  if (input.orgOrigin) {
    const org = new URL(input.orgOrigin);
    url.protocol = org.protocol;
    url.host = org.host;
  }
  url.searchParams.set("token_hash", input.tokenHash);
  url.searchParams.set("type", input.type);
  return url.toString();
}

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Organizatia userului, in ordine:
 *  1. `profiles.organization_id` (magic link, resetare parola, re-invitatie);
 *  2. `user_metadata.organization_id` - pus la invitatie, cand profilul NU exista inca
 *     (se creeaza dupa `inviteUserByEmail`, care declanseaza hook-ul). Metadata e
 *     editabila de user, deci vine DUPA profil - cel mult isi schimba brandul propriilor
 *     emailuri, nu destinatarul;
 *  3. organizatia al carei domeniu propriu e hostul din `redirect_to`.
 * Nimic (ex. super-admin) -> `null` = brandul platformei.
 */
export async function loadOrgForAuthEmail(
  admin: AdminClient,
  payload: SendEmailHookPayload,
): Promise<OrgEmailRow | null> {
  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", payload.user.id)
    .maybeSingle();
  const metadataOrgId = payload.user.user_metadata?.organization_id;
  const organizationId =
    profile?.organization_id ??
    (typeof metadataOrgId === "string" && metadataOrgId ? metadataOrgId : null);

  if (organizationId) {
    const { data } = await admin
      .from("organizations")
      .select(ORG_EMAIL_COLUMNS)
      .eq("id", organizationId)
      .maybeSingle();
    if (data) return data;
  }

  const host = hostOf(payload.email_data.redirect_to);
  if (!host) return null;
  const { data } = await admin
    .from("organizations")
    .select(ORG_EMAIL_COLUMNS)
    .eq("custom_domain", host)
    .maybeSingle();
  return data ?? null;
}

interface OutgoingAuthEmail {
  to: string;
  tokenHash: string | null;
  token: string | null;
}

/**
 * Destinatarii. La `email_change` cu „secure email change”, Supabase cere confirmare
 * pe AMBELE adrese: `token_hash` merge la adresa noua, `token_hash_new` la cea curenta
 * (denumirea inversata e pastrata de Supabase pentru compatibilitate).
 */
function recipientsFor(payload: SendEmailHookPayload): OutgoingAuthEmail[] {
  const { user, email_data: data } = payload;
  if (data.email_action_type === "email_change") {
    const out: OutgoingAuthEmail[] = [];
    const newEmail = user.new_email || null;
    if (newEmail && data.token_hash) {
      out.push({ to: newEmail, tokenHash: data.token_hash, token: data.token ?? null });
    }
    if (user.email && data.token_hash_new) {
      out.push({ to: user.email, tokenHash: data.token_hash_new, token: data.token_new ?? null });
    }
    return out;
  }
  return user.email
    ? [{ to: user.email, tokenHash: data.token_hash ?? null, token: data.token ?? null }]
    : [];
}

/**
 * Trateaza un apel al hook-ului: randeaza si trimite emailul(-urile). Arunca la orice
 * esec (inclusiv al providerului) - ruta raspunde cu eroare, iar Supabase o intoarce
 * actiunii care a cerut emailul; un email Auth pierdut in tacere ar bloca userul.
 */
export async function handleSendEmailHook(
  payload: SendEmailHookPayload,
  provider: EmailProvider = getEmailProvider(),
): Promise<number> {
  const action = payload.email_data.email_action_type;
  if (!isAuthEmailAction(action)) {
    throw new InvalidHookPayloadError(`Tip de email necunoscut: ${action}`);
  }

  const org = await loadOrgForAuthEmail(createAdminClient(), payload);
  const brand = emailBrandFor(org);
  const recipients = recipientsFor(payload);
  if (recipients.length === 0) throw new InvalidHookPayloadError("Userul nu are adresa de email.");

  for (const recipient of recipients) {
    const rendered = renderAuthEmail(action as AuthEmailAction, brand, {
      link:
        recipient.tokenHash && action !== "reauthentication"
          ? buildAuthLink({
              redirectTo: payload.email_data.redirect_to,
              siteUrl: payload.email_data.site_url,
              tokenHash: recipient.tokenHash,
              type: action,
              orgOrigin: brand.customOrigin,
            })
          : null,
      code: recipient.token,
    });
    await provider.send({
      to: recipient.to,
      from: brand.from,
      replyTo: brand.replyTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  }
  return recipients.length;
}
