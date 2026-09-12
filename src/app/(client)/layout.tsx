import type * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { navForRole } from "@/components/layout/nav-config";
import { Topbar } from "@/components/layout/topbar";
import { getCurrentOrg } from "@/features/auth/queries";
import { ROLE_LABELS } from "@/features/auth/roles";
import { requireRole } from "@/features/auth/session";
import { CartProvider } from "@/features/client-portal/cart-context";

/** Shell portal client: tema white-label a organizatiei + navigatie de client. */
export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["client"]);
  const org = await getCurrentOrg();
  const orgName = org?.name ?? "Lateris Trace";
  const logoUrl = org?.logoUrl ?? undefined;
  const items = navForRole(user.role);

  return (
    <AppShell
      orgName={orgName}
      logoUrl={logoUrl}
      theme={{ brand: org?.primaryColor ?? undefined, accent: org?.secondaryColor ?? undefined }}
      items={items}
    >
      <Topbar
        email={user.email}
        roleLabel={ROLE_LABELS[user.role]}
        role={user.role}
        orgName={orgName}
        logoUrl={logoUrl}
        items={items}
      />
      {/* Cosul (catalog -> comanda) traieste in tot portalul, nu doar pe /catalog -
          necesar pentru "Repetă comanda" din /comenzile-mele/[id], care populeaza
          cosul si navigheaza la /catalog. */}
      <CartProvider>{children}</CartProvider>
    </AppShell>
  );
}
