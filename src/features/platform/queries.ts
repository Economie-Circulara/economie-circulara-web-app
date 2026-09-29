import { createClient } from "@/lib/supabase/server";
import { parseStoredRecords, resolveEmailDomainStatus } from "./email-domain";
import type { OrganizationSummary } from "./types";

/**
 * URL-ul de acces al tenantului, in ordinea de precedenta folosita si la rezolvare
 * (vezi src/features/auth/tenant.ts): custom domain > subdomeniu > path (dev/fallback).
 */
function buildAccessUrl(slug: string, customDomain: string | null): string {
  if (customDomain) return `https://${customDomain}`;
  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN;
  if (root) return `https://${slug}.${root}`;
  return `/${slug}`;
}

/**
 * Toate organizatiile platformei, cu numarul de useri fiecareia. Doar super-admin
 * (RLS: `organizations_select` / `profiles_select` permit vizibilitate completa
 * pentru `app.is_super_admin()`).
 */
export async function listOrganizations(): Promise<OrganizationSummary[]> {
  const supabase = await createClient();

  const [{ data: orgs, error: orgsError }, { data: profiles }] = await Promise.all([
    supabase.from("organizations").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("organization_id").not("organization_id", "is", null),
  ]);

  if (orgsError) {
    throw new Error("Nu am putut incarca lista de organizatii.");
  }

  const userCounts = new Map<string, number>();
  for (const profile of profiles ?? []) {
    if (!profile.organization_id) continue;
    userCounts.set(profile.organization_id, (userCounts.get(profile.organization_id) ?? 0) + 1);
  }

  return (orgs ?? []).map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    customDomain: org.custom_domain,
    theme: org.theme,
    layout: org.layout,
    status: org.status,
    createdAt: org.created_at,
    userCount: userCounts.get(org.id) ?? 0,
    accessUrl: buildAccessUrl(org.slug, org.custom_domain),
    email: {
      domain: org.email_domain,
      fromName: org.email_from_name,
      fromAddress: org.email_from_address,
      replyTo: org.email_reply_to,
      status: resolveEmailDomainStatus(org.email_domain_status),
      records: parseStoredRecords(org.email_domain_records),
      checkedAt: org.email_domain_checked_at,
    },
  }));
}

/** O singura organizatie, pentru ecranul de editare din /platform (doar super-admin). */
export async function getOrganizationSummary(id: string): Promise<OrganizationSummary | null> {
  const organizations = await listOrganizations();
  return organizations.find((org) => org.id === id) ?? null;
}
