import type * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { navForRole } from "@/components/layout/nav-config";
import { Topbar } from "@/components/layout/topbar";
import { getCurrentOrg } from "@/features/auth/queries";
import { ROLE_LABELS } from "@/features/auth/roles";
import { requireUser } from "@/features/auth/session";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { PLATFORM_NAME } from "@/lib/brand";

/**
 * Shell pentru manualul din aplicatie. `/ajutor` e o singura ruta pentru TOATE
 * rolurile (nu poate fi definita si in `(admin)`, si in `(client)` - Next refuza
 * doua pagini paralele pe aceeasi cale; din acelasi motiv cautarea e spartaa in
 * `/cautare` vs `/cauta`). Deci guard-ul e `requireUser`, nu `requireRole`, iar
 * filtrarea pe rol se face la nivel de document (`findManualDoc`).
 */
export default async function HelpLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const items = navForRole(user.role);

  // Super-adminul nu are organizatie si nici navigatie de business - primeste
  // shell-ul minimal, ca in `src/app/platform/layout.tsx`.
  if (user.role === "super_admin") {
    return (
      <div className="bg-pattern min-h-svh">
        <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
          <header className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold tracking-tight">{PLATFORM_NAME} - Ajutor</p>
              <p className="text-xs text-muted-foreground">Manualele platformei</p>
            </div>
            <div className="flex min-w-0 items-center gap-3">
              <span className="min-w-0 truncate text-sm font-medium">{user.email}</span>
              <SignOutButton />
            </div>
          </header>
          {children}
        </div>
      </div>
    );
  }

  const org = await getCurrentOrg();
  const orgName = org?.name ?? PLATFORM_NAME;
  const logoUrl = org?.logoUrl ?? undefined;

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
      {children}
    </AppShell>
  );
}
