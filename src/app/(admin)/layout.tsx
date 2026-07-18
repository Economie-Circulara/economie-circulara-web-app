import type * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { navForRole } from "@/components/layout/nav-config";
import { Topbar } from "@/components/layout/topbar";
import { getCurrentOrg } from "@/features/auth/queries";
import { ROLE_LABELS } from "@/features/auth/roles";
import { requireRole } from "@/features/auth/session";

/**
 * Shell admin/operator: sidebar + tema white-label a organizatiei (culori din DB
 * suprascriu --brand / --accent). Guard de rol la nivel de layout.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["admin", "operator"]);
  const org = await getCurrentOrg();

  return (
    <AppShell
      orgName={org?.name ?? "Lateris Trace"}
      logoUrl={org?.logoUrl ?? undefined}
      theme={{ brand: org?.primaryColor ?? undefined, accent: org?.secondaryColor ?? undefined }}
      items={navForRole(user.role)}
    >
      <Topbar email={user.email} roleLabel={ROLE_LABELS[user.role]} role={user.role} />
      {children}
    </AppShell>
  );
}
