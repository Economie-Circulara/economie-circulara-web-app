/**
 * Numele platformei - SINGURUL loc din care se schimba valoarea folosita la runtime.
 *
 * "Provenio" e numele decis (2026-09-12). Motivatia, criteriile si alternativele evaluate:
 * `docs/plans/denumire-produs.md`. Pe scurt: *proveniența* e exact ce dovedeste
 * certificatul de trasabilitate, cuvantul e inteles fara explicatie de un profesionist
 * roman, radacina latina il face lizibil in toata UE, si e neutru fata de tipul de
 * material (platforma nu e despre caramizi sau beton anume).
 *
 * Inlocuieste numele provizoriu "Lateris Trace", aparut in faza de mockup
 * (`docs/design/Lateris_Trace.dc.html` - fisierul isi pastreaza numele, e o referinta
 * istorica) si propagat apoi ca nume de produs. Acela citea ca numele unui client, nu al
 * unei platforme multi-tenant.
 *
 * Folosit ca valoare de fallback oriunde lipseste brandul unei organizatii (white-label):
 * pe domeniul platformei nu exista tenant, deci nu exista brand de organizatie.
 */
export const PLATFORM_NAME = "Provenio";

/** O propozitie despre ce face platforma - folosita in `metadata.description`. */
export const PLATFORM_DESCRIPTION =
  "Platformă multi-tenant pentru trasabilitatea materialelor în economia circulară: loturi, procese, certificate de trasabilitate, avize și e-Transport.";
