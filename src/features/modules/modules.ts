/**
 * Module optionale per organizatie (`organizations.enabled_modules`, migrarea 0055) -
 * le activeaza DOAR super-adminul (`/platform/<id>`). O cheie noua = intrare aici +
 * valoare in CHECK-ul `organizations_enabled_modules_check` (modules.test.ts); un
 * modul activ implicit intra si in `DEFAULT_MODULES` + default-ul coloanei.
 */
export const MODULES = {
  assistant: {
    label: "Asistent AI",
    description:
      "Asistentul AI pentru staff (admin și operator): întrebări, căutare și acțiuni propuse cu confirmare.",
  },
  fleet: {
    label: "Flotă",
    description:
      "Vehicule proprii, jurnal de alimentări și consum de combustibil estimat per comandă transportată.",
  },
} as const;

export type ModuleKey = keyof typeof MODULES;

export const MODULE_KEYS = Object.keys(MODULES) as ModuleKey[];

/** Modulele active pe o organizatie noua (= default-ul coloanei din 0055). */
export const DEFAULT_MODULES: readonly ModuleKey[] = ["assistant"];

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
