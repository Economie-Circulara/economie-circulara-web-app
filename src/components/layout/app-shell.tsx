import type * as React from "react";
import { BrandProvider, type BrandTheme } from "@/components/brand-provider";
import { Sidebar } from "./sidebar";
import type { NavItem } from "./nav-config";

export interface AppShellProps {
  orgName: string;
  logoUrl?: string;
  theme?: BrandTheme;
  items: NavItem[];
  children: React.ReactNode;
}

/**
 * Shell-ul aplicatiei: sidebar fix la stanga + zona de continut cu pattern subtil.
 * Tema organizatiei (white label) se aplica peste tot prin BrandProvider.
 */
export function AppShell({ orgName, logoUrl, theme, items, children }: AppShellProps) {
  return (
    <BrandProvider theme={theme}>
      <div className="flex min-h-svh">
        <Sidebar orgName={orgName} logoUrl={logoUrl} items={items} />
        <main className="bg-pattern flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-7xl space-y-6 p-6">{children}</div>
        </main>
      </div>
    </BrandProvider>
  );
}
