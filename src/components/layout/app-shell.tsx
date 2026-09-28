import type * as React from "react";
import { BrandProvider, type BrandTheme } from "@/components/brand-provider";
import { Sidebar } from "./sidebar";
import type { NavEntry } from "./nav-config";

export interface AppShellProps {
  orgName: string;
  logoUrl?: string;
  theme?: BrandTheme;
  /** Cheia temei vizuale a organizatiei (`organizations.theme`). */
  themeKey?: string;
  items: NavEntry[];
  /** Vezi `SidebarProps.showPlatformLogo`. */
  showPlatformLogo?: boolean;
  children: React.ReactNode;
}

/**
 * Shell-ul aplicatiei: sidebar fix la stanga + zona de continut cu pattern subtil.
 * Tema organizatiei (white label) se aplica peste tot prin BrandProvider.
 */
export function AppShell({
  orgName,
  logoUrl,
  theme,
  themeKey,
  items,
  showPlatformLogo,
  children,
}: AppShellProps) {
  return (
    <BrandProvider theme={theme} themeKey={themeKey}>
      <div className="flex min-h-svh bg-background text-foreground">
        <Sidebar
          orgName={orgName}
          logoUrl={logoUrl}
          items={items}
          showPlatformLogo={showPlatformLogo}
        />
        <main className="bg-pattern flex-1 overflow-x-clip">
          <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </BrandProvider>
  );
}
