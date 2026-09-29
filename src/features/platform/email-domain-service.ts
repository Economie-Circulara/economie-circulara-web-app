import type { Database, Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";
import type { EmailDomainInfo, EmailDomainProvider } from "./email-domain-provider";

/**
 * Gestionarea domeniului de email al unei organizatii din /platform (super-admin; plan
 * docs/plans/email-white-label-per-domeniu.md, Etapa 2). Ruleaza pe sesiunea
 * super-adminului: garda din 0050 respinge aceleasi coloane pentru oricine altcineva.
 */

export class EmailDomainNotConfiguredError extends Error {
  constructor() {
    super("Organizatia nu are un domeniu de email configurat.");
    this.name = "EmailDomainNotConfiguredError";
  }
}

type SessionClient = Awaited<ReturnType<typeof createClient>>;
type OrganizationUpdate = Database["public"]["Tables"]["organizations"]["Update"];

interface CurrentEmailDomain {
  email_domain: string | null;
  email_domain_provider_id: string | null;
}

async function loadCurrent(supabase: SessionClient, organizationId: string) {
  const { data, error } = await supabase
    .from("organizations")
    .select("email_domain, email_domain_provider_id")
    .eq("id", organizationId)
    .maybeSingle();
  if (error || !data) throw new Error("Organizatia nu a putut fi incarcata.");
  return data as CurrentEmailDomain;
}

async function saveState(
  supabase: SessionClient,
  organizationId: string,
  patch: OrganizationUpdate,
): Promise<void> {
  const { error } = await supabase.from("organizations").update(patch).eq("id", organizationId);
  if (error) throw new Error("Nu am putut salva setarile de email ale organizatiei.");
}

function infoPatch(info: EmailDomainInfo): OrganizationUpdate {
  return {
    email_domain_provider_id: info.id,
    email_domain_status: info.status,
    email_domain_records: info.records as unknown as Json,
    email_domain_checked_at: new Date().toISOString(),
  };
}

/**
 * Sterge domeniul de la provider doar daca nicio alta organizatie nu il foloseste;
 * best-effort - curatarea locala conteaza, un domeniu ramas in Resend nu strica nimic.
 */
async function releaseProviderDomain(
  supabase: SessionClient,
  provider: EmailDomainProvider,
  organizationId: string,
  providerId: string | null,
): Promise<void> {
  if (!providerId) return;
  const { data: others } = await supabase
    .from("organizations")
    .select("id")
    .eq("email_domain_provider_id", providerId)
    .neq("id", organizationId);
  if (others && others.length > 0) return;
  await provider.removeDomain(providerId).catch(() => undefined);
}

/** Scoate domeniul de email: organizatia trimite din nou de pe adresa platformei. */
export async function removeEmailDomain(
  organizationId: string,
  provider: EmailDomainProvider,
): Promise<void> {
  const supabase = await createClient();
  const current = await loadCurrent(supabase, organizationId);
  await releaseProviderDomain(supabase, provider, organizationId, current.email_domain_provider_id);
  await saveState(supabase, organizationId, {
    email_domain: null,
    email_domain_provider_id: null,
    email_domain_status: "not_configured",
    email_domain_records: [],
    email_domain_checked_at: null,
    email_from_address: null,
  });
}

/**
 * Seteaza domeniul si adresa expeditorului. Domeniu nou -> il creeaza la provider si
 * salveaza inregistrarile DNS de adaugat; acelasi domeniu -> schimba doar adresa.
 * `domain = null` -> scoate domeniul.
 */
export async function configureEmailDomain(
  organizationId: string,
  input: { domain: string | null; localPart: string },
  provider: EmailDomainProvider,
): Promise<void> {
  if (!input.domain) {
    await removeEmailDomain(organizationId, provider);
    return;
  }
  const supabase = await createClient();
  const current = await loadCurrent(supabase, organizationId);
  const fromAddress = `${input.localPart}@${input.domain}`;

  if (current.email_domain === input.domain && current.email_domain_provider_id) {
    await saveState(supabase, organizationId, { email_from_address: fromAddress });
    return;
  }

  const info = await provider.createDomain(input.domain);
  if (current.email_domain_provider_id && current.email_domain_provider_id !== info.id) {
    await releaseProviderDomain(
      supabase,
      provider,
      organizationId,
      current.email_domain_provider_id,
    );
  }
  await saveState(supabase, organizationId, {
    email_domain: input.domain,
    email_from_address: fromAddress,
    ...infoPatch(info),
  });
}

/** Cere reverificarea DNS la provider si salveaza statusul + inregistrarile. */
export async function refreshEmailDomain(
  organizationId: string,
  provider: EmailDomainProvider,
): Promise<EmailDomainInfo> {
  const supabase = await createClient();
  const current = await loadCurrent(supabase, organizationId);
  if (!current.email_domain_provider_id) throw new EmailDomainNotConfiguredError();

  const info = await provider.verifyDomain(current.email_domain_provider_id);
  await saveState(supabase, organizationId, infoPatch(info));
  return info;
}
