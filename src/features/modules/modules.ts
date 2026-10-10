/**
 * Module optionale per organizatie (`organizations.enabled_modules`, migrarea 0055) -
 * le activeaza DOAR super-adminul (`/platform/<id>`). O cheie noua = intrare aici +
 * valoare in CHECK-ul `organizations_enabled_modules_check` (modules.test.ts).
 */
export const MODULES = {
  fleet: {
    label: "Flotă",
    description:
      "Vehicule proprii, jurnal de alimentări și consum de combustibil estimat per comandă transportată.",
  },
} as const;

export type ModuleKey = keyof typeof MODULES;

export const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

export function isModuleKey(value: string): value is ModuleKey {
  return (MODULE_KEYS as string[]).includes(value);
}

/** Valorile din DB, filtrate la cheile cunoscute (o cheie retrasa din cod e ignorata). */
export function resolveModules(raw: readonly string[] | null | undefined): ModuleKey[] {
  return (raw ?? []).filter(isModuleKey);
}

export function hasModule(
  org: { enabledModules: readonly string[] } | null | undefined,
  key: ModuleKey,
): boolean {
  return org ? org.enabledModules.includes(key) : false;
}
