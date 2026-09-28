import { PLATFORM_NAME } from "@/lib/brand";
import {
  DEFAULT_DOCUMENT_TAGLINE,
  getTenantProfile,
  issuerCreditFor,
  type ProductNameOrg,
  type TenantProfile,
} from "./tenant-profiles";
import { orgBrandColors } from "./brand-colors";
import { THEMES, resolveThemeKey, type PdfHeaderVariant } from "./themes";

/**
 * Identitatea vizuala a documentelor PDF (certificat, aviz, rapoarte) pentru o
 * organizatie (plan multi-domain-tenant-profiles, T6): ASPECTUL vine din tema (stilul
 * antetului + culorile implicite), TEXTELE din profil (subtitlu, nota din subsol,
 * creditul „emis de”). Culorile setate de adminul organizatiei se aplica doar pe tema
 * implicita (`orgBrandColors`).
 */
export interface PdfBrand {
  brandColor: string;
  accentColor: string;
  headerVariant: PdfHeaderVariant;
  tagline: string;
  footerNote: string | null;
  issuerCredit: string | null;
}

export interface PdfBrandOrg extends ProductNameOrg {
  primaryColor?: string | null;
  secondaryColor?: string | null;
  theme?: string | null;
}

/** Doar culori hex sunt sigure in @react-pdf (oklch() etc. nu sunt suportate). */
function hexOr(value: string | null | undefined, fallback: string): string {
  const color = value?.trim();
  return color && /^#[0-9a-f]{3}(?:[0-9a-f]{3})?$/i.test(color) ? color : fallback;
}

export function pdfBrandFor(
  org: PdfBrandOrg | null | undefined,
  profiles?: Record<string, TenantProfile>,
): PdfBrand {
  const theme = THEMES[resolveThemeKey(org?.theme)];
  const profile = getTenantProfile(org?.slug, profiles);
  // Culorile din Setari doar pe tema implicita - altfel tema aleasa de platforma.
  const orgColors = orgBrandColors(org);
  return {
    brandColor: hexOr(orgColors.brand, theme.swatches.brand),
    accentColor: hexOr(orgColors.accent, theme.swatches.accent),
    headerVariant: theme.pdfHeader,
    tagline: profile.documentTagline ?? DEFAULT_DOCUMENT_TAGLINE,
    footerNote: profile.documentFooterNote ?? null,
    issuerCredit: org ? issuerCreditFor(org, profiles) : PLATFORM_NAME,
  };
}

/** `PdfBrand` ca props ale componentelor PDF (certificat, aviz, raport). */
export function pdfBrandProps(brand: PdfBrand) {
  return {
    brandColor: brand.brandColor,
    accentColor: brand.accentColor,
    issuerCredit: brand.issuerCredit,
    headerVariant: brand.headerVariant,
    tagline: brand.tagline,
    footerNote: brand.footerNote,
  };
}
