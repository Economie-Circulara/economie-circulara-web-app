/**
 * Linia de identificare fiscala a emitentului, afisata pe certificat (web + PDF) -
 * organizatii.cui/reg_com/address, migrarea 0023_organization_legal_fields.sql.
 * Functie PURA, partajata intre `certificate-view.tsx` (ecran) si `pdf.tsx`
 * (`@react-pdf/renderer`), ca formatul sa ramana identic in ambele randari.
 * Doar piesele completate apar - toate 3 campuri sunt optionale (organizatii
 * vechi, necompletate inca din Setari).
 */
export function formatIssuerLine(
  cui?: string | null,
  regCom?: string | null,
  address?: string | null,
): string | null {
  const parts = [cui ? `CUI ${cui}` : null, regCom, address].filter((part): part is string =>
    Boolean(part),
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}
