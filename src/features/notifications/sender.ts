import type { EmailAddress } from "./provider";

/**
 * Expeditorul emailurilor unei organizatii (plan: docs/plans/email-white-label-per-domeniu.md).
 *
 * Adresa organizatiei se foloseste DOAR cand domeniul ei de email e verificat la
 * provider (`email_domain_status = 'verified'`) si adresa e exact pe acel domeniu -
 * altfel providerul ar respinge mesajul. In rest emailul pleaca de pe adresa
 * platformei, dar cu NUMELE organizatiei: un domeniu neconfigurat nu pierde emailuri.
 */
export interface OrgSenderConfig {
  fromName?: string | null;
  fromAddress?: string | null;
  emailDomain?: string | null;
  emailDomainStatus?: string | null;
  replyTo?: string | null;
}

export interface ResolvedSender {
  from: EmailAddress;
  replyTo: string | null;
}

/** Adresa `address` e pe exact domeniul `domain` (fara subdomenii). */
export function isAddressOnDomain(address: string, domain: string): boolean {
  const at = address.lastIndexOf("@");
  return at > 0 && address.slice(at + 1).toLowerCase() === domain.trim().toLowerCase();
}

/** Domeniul organizatiei poate fi folosit ca expeditor. */
export function canSendFromOrgDomain(org: OrgSenderConfig | null | undefined): boolean {
  const address = org?.fromAddress?.trim();
  const domain = org?.emailDomain?.trim();
  return Boolean(
    address &&
    domain &&
    org?.emailDomainStatus === "verified" &&
    isAddressOnDomain(address, domain),
  );
}

export function resolveEmailSender(
  org: OrgSenderConfig | null | undefined,
  fallback: EmailAddress,
): ResolvedSender {
  const name = org?.fromName?.trim() || fallback.name || null;
  const address = canSendFromOrgDomain(org) ? org!.fromAddress!.trim() : fallback.address;
  return { from: { name, address }, replyTo: org?.replyTo?.trim() || null };
}
