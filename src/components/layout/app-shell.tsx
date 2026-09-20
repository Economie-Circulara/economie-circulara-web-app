import type * as React from "react";
import { BrandProvider, type BrandTheme } from "@/components/brand-provider";
import { Sidebar } from "./sidebar";
import type { NavEntry } from "./nav-config";

export interface AppShellProps {
  orgName: string;
  logoUrl?: string;
  theme?: BrandTheme;
  items: NavEntry[];
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
        {/*
         * `min-w-0`: fara el, un flex item nu se poate micsora sub latimea sa
         * INTRINSECA (continutul cel mai lat, ex. un tabel cu multe coloane) -
         * `overflow-x-clip` de mai jos nu ajuta, fiindca randul flex (sidebar +
         * main) devine el insusi mai lat decat viewport-ul INAINTE ca clipping-ul
         * sa intre in joc. Printins de `tests/e2e/routes-smoke.spec.ts` (verifica
         * overflow orizontal pe fiecare ruta) - /comenzi (tabel cu multe coloane
         * pe mobil) a fost prima pagina care l-a scos la iveala. */}
        <main className="bg-pattern min-w-0 flex-1 overflow-x-clip">
          <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </BrandProvider>
  );
}
