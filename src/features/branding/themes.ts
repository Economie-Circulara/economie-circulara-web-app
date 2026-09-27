/**
 * Temele vizuale ale aplicatiei (plan: docs/plans/multi-domain-tenant-profiles.md, T5).
 *
 * O tema grupeaza tot ce tine de ASPECT: paleta (light + dark), font, colturi,
 * pattern de fundal, stilul sidebar-ului si layout-ul ecranului de login. Se alege per
 * organizatie (`organizations.theme`, doar super-admin) si se aplica prin atributul
 * `data-theme` - valorile propriu-zise sunt in `src/app/themes.css`.
 *
 * Aici stau doar metadatele (nume, descriere, mostre pentru selector) si cheile, ca
 * restul codului sa nu depinda de CSS. O cheie noua cere: definitie aici + bloc CSS +
 * valoare in CHECK-ul din migrare (`organizations_theme_check`).
 */

export const THEME_KEYS = ["default", "teren", "industrial", "ciclu"] as const;

export type ThemeKey = (typeof THEME_KEYS)[number];

export const DEFAULT_THEME: ThemeKey = "default";

export interface ThemeDefinition {
  key: ThemeKey;
  label: string;
  description: string;
  /** Mostre (hex) pentru selectorul din /platform si pentru PDF-uri (T6). */
  swatches: { brand: string; accent: string; paper: string; sidebar: string };
}

export const THEMES: Record<ThemeKey, ThemeDefinition> = {
  default: {
    key: "default",
    label: "Clasic",
    description: "Verde închis și ocru, font Archivo, colțuri medii, fundal cu puncte.",
    swatches: { brand: "#1f4a37", accent: "#d69a3a", paper: "#f7f5ef", sidebar: "#fdfcf9" },
  },
  teren: {
    key: "teren",
    label: "Teren",
    description:
      "Tonuri calde de pământ (teracotă și nisip), font rotunjit, colțuri mari, login cu panou lateral.",
    swatches: { brand: "#9a4a2c", accent: "#d4a94a", paper: "#faf5ee", sidebar: "#fffcf8" },
  },
  industrial: {
    key: "industrial",
    label: "Industrial",
    description:
      "Antracit cu accent portocaliu, font tehnic, colțuri drepte, grilă fină, meniu lateral închis.",
    swatches: { brand: "#2e3440", accent: "#e8742a", paper: "#f3f4f6", sidebar: "#23272f" },
  },
  ciclu: {
    key: "ciclu",
    label: "Ciclu",
    description:
      "Verde-teal cu accent lime, font geometric, fundal cu linii diagonale, meniu lateral colorat.",
    swatches: { brand: "#11706c", accent: "#9ccc3c", paper: "#f2f8f7", sidebar: "#0f5f5c" },
  },
};

export function isThemeKey(value: unknown): value is ThemeKey {
  return typeof value === "string" && (THEME_KEYS as readonly string[]).includes(value);
}

/** Cheia de tema valida pentru o valoare din DB (necunoscuta/lipsa -> `default`). */
export function resolveThemeKey(value: string | null | undefined): ThemeKey {
  return isThemeKey(value) ? value : DEFAULT_THEME;
}
