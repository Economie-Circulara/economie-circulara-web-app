/** Cheile rapoartelor din pagina /rapoarte — folosite in query-ul rutelor de export. */
export const REPORT_KEYS = [
  "comenzi",
  "livrari",
  "retururi",
  "materiale-reciclate",
  "paas-utilizare",
  "materii-secundare",
] as const;

export type ReportKey = (typeof REPORT_KEYS)[number];

export function isReportKey(value: string | null | undefined): value is ReportKey {
  return !!value && (REPORT_KEYS as readonly string[]).includes(value);
}

/** Titlu + descriere RO pentru fiecare raport — reutilizate in UI si in antetul PDF. */
export const REPORT_META: Record<ReportKey, { title: string; description: string }> = {
  comenzi: {
    title: "Comenzi pe perioadă",
    description: "Numărul de comenzi create în perioadă, grupate pe status.",
  },
  livrari: {
    title: "Livrări",
    description: "Comenzile livrate sau închise în perioadă.",
  },
  retururi: {
    title: "Retururi și garanții",
    description: "Legăturile de retur/garanție cerute în perioadă.",
  },
  "materiale-reciclate": {
    title: "Materiale reciclate/recondiționate reintegrate",
    description:
      "Loturi cu proveniență reciclare, recondiționare sau retur, intrate în stoc în perioadă.",
  },
  "paas-utilizare": {
    title: "Utilizare PaaS (livrat − returnat)",
    description:
      "Cantitatea efectiv utilizată de fiecare client (livrat minus returnat acceptat), per produs.",
  },
  "materii-secundare": {
    title: "% materii prime secundare",
    description:
      "Ponderea materiilor prime secundare (reciclate/recondiționate/retur) din inputul de producție, per produs.",
  },
};
