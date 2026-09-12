/**
 * Numele platformei - SINGURUL loc din care se schimba valoarea folosita la runtime.
 *
 * "Lot cu Lot" e numele decis (2026-09-12), cu domeniul **lotculot.eu**. Descrie exact
 * mecanismul produsului: trasabilitatea se construieste *lot cu lot*, iar "lot" e deja
 * termenul de domeniu din aplicatie (`lots`, `process_inputs`/`process_outputs`,
 * consumul FIFO). Avantajul fata de alternativele evaluate: e autoexplicativ pentru
 * utilizatorul real (operator/administrator roman), fara sa pretinda o autoritate pe care
 * platforma NU o are - vezi `docs/analiza-standarde-certificat.md`, care stabileste ca
 * certificatul e o declaratie VOLUNTARA, nu o atestare oficiala.
 *
 * Istoricul deciziei si alternativele (Provenio, Evidentia, Filiera, Agrega, ...) sunt in
 * `docs/plans/denumire-produs.md`.
 *
 * Inlocuieste numele provizoriu "Lateris Trace", aparut in faza de mockup
 * (`docs/design/Lateris_Trace.dc.html` - fisierul isi pastreaza numele, e o referinta
 * istorica) si propagat apoi ca nume de produs; acela citea ca numele unui client, nu al
 * unei platforme multi-tenant, iar *later* (lat.) = caramida era prea ingust.
 *
 * Folosit ca valoare de fallback oriunde lipseste brandul unei organizatii (white-label):
 * pe domeniul platformei nu exista tenant, deci nu exista brand de organizatie.
 */
export const PLATFORM_NAME = "Lot cu Lot";

/** O propozitie despre ce face platforma - folosita in `metadata.description`. */
export const PLATFORM_DESCRIPTION =
  "Platformă multi-tenant pentru trasabilitatea materialelor în economia circulară: loturi, procese, certificate de trasabilitate, avize și e-Transport.";
