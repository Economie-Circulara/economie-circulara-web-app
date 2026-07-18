/**
 * Selectia de perioada pentru pagina Rapoarte + KPI-urile de dashboard — functii
 * PURE (fara Supabase), testate direct (`period.test.ts`). Datele sunt manipulate ca
 * text ISO `YYYY-MM-DD` (fara ora) — perioada e mereu inclusiva la ambele capete.
 */

export interface DateRange {
  /** `YYYY-MM-DD`, inclusiv. */
  from: string;
  /** `YYYY-MM-DD`, inclusiv. */
  to: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string | undefined | null): value is string {
  if (!value || !ISO_DATE_RE.test(value)) return false;
  return !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Prima zi a lunii curente (UTC) → azi. Interval implicit pentru pagina Rapoarte. */
export function currentMonthRange(now: Date = new Date()): DateRange {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { from: toIsoDate(start), to: toIsoDate(now) };
}

/**
 * Parseaza + valideaza perioada din query params (`?from=&to=`); cade pe luna curenta
 * daca lipsesc/sunt invalide. Daca `from > to`, le inverseaza defensiv (nu arunca eroare
 * — un utilizator care inverseaza datele in URL nu trebuie sa vada un ecran stricat).
 */
export function parseDateRange(
  params: { from?: string | null; to?: string | null },
  now: Date = new Date(),
): DateRange {
  const fallback = currentMonthRange(now);
  const from = isValidIsoDate(params.from) ? params.from : fallback.from;
  const to = isValidIsoDate(params.to) ? params.to : fallback.to;
  return from <= to ? { from, to } : { from: to, to: from };
}

/** Inceputul zilei (`00:00:00.000Z`) — pentru comparatii/query-uri pe coloane timestamptz. */
export function startOfDayIso(dateIso: string): string {
  return `${dateIso}T00:00:00.000Z`;
}

/**
 * Limita superioara EXCLUSIVA a intervalului (ziua urmatoare lui `to`, miezul noptii UTC)
 * — folosita cu `.lt()` in query-uri pe coloane timestamptz, ca sa includa toata ziua `to`
 * indiferent de ora exacta a inregistrarii.
 */
export function exclusiveEndOfDay(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

/**
 * `true` daca un timestamp ISO (cu sau fara ora) cade in interval, inclusiv la ambele
 * capete. `null`/`undefined`/text invalid → `false` (nu poate fi plasat in nicio perioada).
 */
export function isDateWithinRange(dateIso: string | null | undefined, range: DateRange): boolean {
  if (!dateIso) return false;
  const day = dateIso.slice(0, 10);
  if (!ISO_DATE_RE.test(day)) return false;
  return day >= range.from && day <= range.to;
}

const RANGE_LABEL_FORMATTER = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });

/** Eticheta afisabila a perioadei, ex. "1 iul. 2026 – 18 iul. 2026". */
export function formatRangeLabel(range: DateRange): string {
  const from = RANGE_LABEL_FORMATTER.format(new Date(startOfDayIso(range.from)));
  const to = RANGE_LABEL_FORMATTER.format(new Date(startOfDayIso(range.to)));
  return `${from} – ${to}`;
}
