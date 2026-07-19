/**
 * Generator CSV generic pentru rapoarte — acelasi format ca `stock/csv.ts`
 * (RFC 4180, separator `,`, CRLF, BOM UTF-8 pt. diacritice/Excel), dar reutilizabil
 * de toate cele 6 rapoarte (headere + randuri deja formatate ca text, per raport).
 */

/** Scapa un camp pentru CSV (RFC 4180): incadreaza in ghilimele daca e nevoie. */
function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function toCsvRow(fields: string[]): string {
  return fields.map(escapeCsvField).join(",");
}

/** Construieste textul CSV complet (cu BOM) dintr-un set de headere + randuri text. */
export function buildReportCsv(headers: string[], rows: string[][]): string {
  const lines = [toCsvRow(headers), ...rows.map(toCsvRow)];
  const BOM = String.fromCharCode(0xfeff);
  return BOM + lines.join("\r\n") + "\r\n";
}
