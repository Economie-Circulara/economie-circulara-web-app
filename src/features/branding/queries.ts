import { cache } from "react";
import { headers } from "next/headers";
import { getOrgBranding, type OrgBranding } from "@/features/auth/queries";
import { resolveTenant } from "@/features/auth/tenant";
import { productNameFor } from "./tenant-profiles";

/**
 * Organizatia rezolvata din HOSTUL cererii (custom domain / subdomeniu), independent de
 * sesiune - pentru ecranele publice si pentru `metadata`. Memorata per cerere.
 */
export const getHostTenantBranding = cache(async (): Promise<OrgBranding | null> => {
  const h = await headers();
  const hint = resolveTenant(h.get("host"), "/", process.env.NEXT_PUBLIC_ROOT_DOMAIN);
  return getOrgBranding(hint);
});

/** Numele aplicatiei pe hostul curent (titlul tab-ului, ecrane publice). */
export async function getHostProductName(): Promise<string> {
  return productNameFor(await getHostTenantBranding());
}
