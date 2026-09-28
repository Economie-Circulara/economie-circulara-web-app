import { DEFAULT_THEME, resolveThemeKey } from "./themes";

/**
 * Culorile white-label ale organizatiei (Setari -> Culori) care se APLICA efectiv.
 *
 * Tema aleasa de super-admin are prioritate (decizie 2026-09-28,
 * docs/plans/tema-vs-culori-organizatie.md): culorile adminului se folosesc doar pe
 * tema implicita („Clasic”); pe orice alta tema paleta vine din tema, altfel tema
 * aleasa de platforma ar fi suprascrisa si nu s-ar vedea.
 */
export interface OrgColorSource {
  theme?: string | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
}

export function themeAllowsOrgColors(theme: string | null | undefined): boolean {
  return resolveThemeKey(theme) === DEFAULT_THEME;
}

export function orgBrandColors(org: OrgColorSource | null | undefined): {
  brand?: string;
  accent?: string;
} {
  if (!org || !themeAllowsOrgColors(org.theme)) return {};
  return {
    brand: org.primaryColor?.trim() || undefined,
    accent: org.secondaryColor?.trim() || undefined,
  };
}
