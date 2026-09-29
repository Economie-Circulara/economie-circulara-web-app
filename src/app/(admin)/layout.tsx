import { PLATFORM_NAME } from "@/lib/brand";
import type * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { navForRole } from "@/components/layout/nav-config";
import { Topbar } from "@/components/layout/topbar";
import { getCurrentOrg } from "@/features/auth/queries";
import { productNameFor } from "@/features/branding/tenant-profiles";
import { resolveThemeKey } from "@/features/branding/themes";
import { orgBrandColors } from "@/features/branding/brand-colors";
import { resolveLayoutKey } from "@/features/branding/layouts";
import { ROLE_LABELS } from "@/features/auth/roles";
import { requireRole } from "@/features/auth/session";
import { inlineLogoOf } from "@/features/branding/logos";

/**
 * Shell admin/operator: sidebar + tema white-label a organizatiei (culori din DB
 * suprascriu --brand / --accent). Guard de rol la nivel de layout.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["admin", "operator"]);
  const org = await getCurrentOrg();
  const orgName = org?.name ?? PLATFORM_NAME;
  const logoUrl = inlineLogoOf(org);
  const items = navForRole(user.role, resolveLayoutKey(org?.layout));

  return (
    <AppShell
      orgName={orgName}
      logoUrl={logoUrl}
      theme={orgBrandColors(org)}
      items={items}
      showPlatformLogo={productNameFor(org) === PLATFORM_NAME}
      themeKey={resolveThemeKey(org?.theme)}
    >
      <Topbar
        email={user.email}
        roleLabel={ROLE_LABELS[user.role]}
        role={user.role}
        orgName={orgName}
        logoUrl={logoUrl}
        items={items}
      />
      {children}
    </AppShell>
  );
}
