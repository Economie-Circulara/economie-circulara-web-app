import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { cache } from "react";
import { resolveBranding, type ResolvedBranding } from "./branding";
import { parseSiteContent, type SiteContent } from "./content";

/**
 * Tenantul se alege la build prin `SITE_TENANT` (setat per proiect Vercel). Un singur
 * cod, cate un deploy per client - vezi docs/plans/site-prezentare-tenanti.md.
 */

const CONTENT_DIR = path.join(process.cwd(), "content");
const TENANT_RE = /^[a-z0-9-]+$/;

export function availableTenants(dir: string = CONTENT_DIR): string[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.slice(0, -".json".length))
    .sort();
}

export function selectTenant(value: string | undefined, tenants: string[]): string {
  const tenant = value?.trim().toLowerCase();
  if (!tenant) {
    throw new Error(`SITE_TENANT nu e setat. Valori posibile: ${tenants.join(", ")}.`);
  }
  if (!TENANT_RE.test(tenant) || !tenants.includes(tenant)) {
    throw new Error(
      `SITE_TENANT="${tenant}" nu are content/${tenant}.json. Valori posibile: ${tenants.join(", ")}.`,
    );
  }
  return tenant;
}

export interface Site {
  tenant: string;
  content: SiteContent;
  branding: ResolvedBranding;
}

export const getSite = cache(async (): Promise<Site> => {
  const tenant = selectTenant(process.env.SITE_TENANT, availableTenants());
  const raw: unknown = JSON.parse(readFileSync(path.join(CONTENT_DIR, `${tenant}.json`), "utf8"));
  const content = parseSiteContent(tenant, raw);
  const branding = await resolveBranding(content, {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
  });
  return { tenant, content, branding };
});
