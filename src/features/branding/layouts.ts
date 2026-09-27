import type { NavLayoutKey } from "@/components/layout/nav-config";

/**
 * Organizarea aplicatiei per organizatie (plan multi-domain-tenant-profiles, T4):
 * gruparea meniului + aranjamentul panoului de control. Se alege in /platform
 * (`organizations.layout`, doar super-admin), la fel ca tema - independent de ea.
 * O cheie noua cere: definitie aici + CHECK-ul din migrarea 0046 + `navForRole` +
 * aranjamentul din `src/app/(admin)/dashboard/page.tsx` (`layouts.test.ts` verifica
 * CHECK-ul).
 */
export const LAYOUT_KEYS = ["standard", "flux"] as const satisfies readonly NavLayoutKey[];

export type LayoutKey = (typeof LAYOUT_KEYS)[number];

export const DEFAULT_LAYOUT: LayoutKey = "standard";

export interface LayoutDefinition {
  key: LayoutKey;
  label: string;
  description: string;
  /** Titlul paginii /dashboard (si eticheta ei din meniu). */
  dashboardTitle: string;
}

export const LAYOUTS: Record<LayoutKey, LayoutDefinition> = {
  standard: {
    key: "standard",
    label: "Standard",
    description:
      "Meniu grupat pe Comenzi / Stoc / Setări; panou cu indicatori sus, grafic de stoc și ultimele comenzi.",
    dashboardTitle: "Panou de control",
  },
  flux: {
    key: "flux",
    label: "Flux",
    description:
      "Meniu grupat pe activități (Producție → Vânzări → Inventar → Administrare); panou care începe cu ce e de făcut și acțiuni rapide.",
    dashboardTitle: "Acasă",
  },
};

export function isLayoutKey(value: unknown): value is LayoutKey {
  return typeof value === "string" && (LAYOUT_KEYS as readonly string[]).includes(value);
}

/** Cheia valida pentru o valoare din DB (necunoscuta/lipsa -> `standard`). */
export function resolveLayoutKey(value: string | null | undefined): LayoutKey {
  return isLayoutKey(value) ? value : DEFAULT_LAYOUT;
}
