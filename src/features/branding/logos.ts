/**
 * Organizatia are doua variante de logo, ambele optionale (migrarea 0049):
 * - `logoUrl` = ORIZONTAL (simbol + nume pe un rand) - sidebar, login, pagina de start;
 * - `logoSquareUrl` = PATRAT (simbol) - favicon.
 * Fiecare loc foloseste varianta potrivita, iar cealalta e rezerva cand lipseste.
 */
export interface OrgLogos {
  logoUrl?: string | null;
  logoSquareUrl?: string | null;
}

/** Logo-ul pentru spatii late (sidebar, login, antet): orizontal, altfel patrat. */
export function inlineLogoOf(org: OrgLogos | null | undefined): string | undefined {
  return org?.logoUrl || org?.logoSquareUrl || undefined;
}

/** Logo-ul pentru spatii patrate (favicon): patrat, altfel orizontal. */
export function squareLogoOf(org: OrgLogos | null | undefined): string | undefined {
  return org?.logoSquareUrl || org?.logoUrl || undefined;
}
