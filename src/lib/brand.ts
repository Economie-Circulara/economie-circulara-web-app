/**
 * Numele platformei - SINGURUL loc din care se schimba.
 *
 * PROVIZORIU. "Lateris Trace" a fost un nume aparut in faza de mockup
 * (`docs/design/Lateris_Trace.dc.html`) si s-a raspandit apoi ca nume de produs prin
 * titluri de pagina si valori de fallback. NU vine de la client: nu apare nici in
 * `docs/brain-dump.md`, nici in `docs/design-prompt.md`. Decizia de denumire e deschisa -
 * vezi `docs/plans/denumire-produs.md`.
 *
 * Pana la decizie, entry point-ul public NU afiseaza un brand inventat: descrie functia
 * platformei. Cand numele e stabilit, se schimba aici si se face un singur pass de
 * inlocuire peste titlurile de pagina rămase.
 */
export const PLATFORM_NAME = "Trasabilitate circulară";

/** O propozitie despre ce face platforma - folosita in `metadata.description`. */
export const PLATFORM_DESCRIPTION =
  "Platformă multi-tenant pentru trasabilitatea materialelor în economia circulară: loturi, procese, certificate de trasabilitate, avize și e-Transport.";
