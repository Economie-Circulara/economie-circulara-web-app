import type * as React from "react";
import { requireRole } from "@/features/auth/session";
import { SignOutButton } from "@/features/auth/sign-out-button";

/**
 * Shell minim pentru super-admin — NU foloseste `AppShell` (sidebar-ul de business
 * cu navigatia catre stoc/comenzi/etc.): super-adminul administreaza platforma
 * (organizatii), nu datele de business ale unui tenant. Doar un topbar simplu cu
 * identitate + delogare. Guard de rol la nivel de layout (ca in (admin)/layout.tsx).
 */
export default async function PlatformLayout({ children }: { children: React.ReactNode }) {
  const user = await requireRole(["super_admin"]);

  return (
    <div className="bg-pattern min-h-svh">
      <div className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="flex items-center justify-between border-b pb-4">
          <div>
            <p className="text-sm font-semibold tracking-tight">Lateris Trace — Platforma</p>
            <p className="text-xs text-muted-foreground">Administrare organizatii (super-admin)</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{user.email}</span>
            <SignOutButton />
          </div>
        </header>
        {children}
      </div>
    </div>
  );
}
