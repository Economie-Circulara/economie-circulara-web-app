import { STOCK_EVENT_LABELS } from "./labels";
import type { StockEvent } from "./types";

const CSV_HEADERS = [
  "Data",
  "Tip eveniment",
  "Item",
  "Lot",
  "Cantitate",
  "Motiv",
  "Comanda",
  "Proces",
  "Utilizator",
] as const;

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

/**
 * Genereaza CSV-ul de export pentru ecranul Audit stoc (`/stoc/audit`). Foloseste
 * separator `,` si CRLF (compatibil Excel), cu BOM UTF-8 pentru diacritice.
 */
export function stockEventsToCsv(events: StockEvent[]): string {
  const lines = [toCsvRow([...CSV_HEADERS])];

  for (const event of events) {
    lines.push(
      toCsvRow([
        event.createdAt,
        STOCK_EVENT_LABELS[event.eventType] ?? event.eventType,
        event.itemTitle,
        event.lotId ? event.lotId.slice(0, 8).toUpperCase() : "—",
        String(event.quantity),
        event.reason ?? "",
        event.orderId ?? "",
        event.processId ?? "",
        event.createdByName ?? "",
      ]),
    );
  }

  const BOM = String.fromCharCode(0xfeff);
  return BOM + lines.join("\r\n") + "\r\n";
}
