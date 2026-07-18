import { NextResponse, type NextRequest } from "next/server";
import { requireRole } from "@/features/auth/session";
import { stockEventsToCsv } from "@/features/stock/csv";
import { listStockEvents } from "@/features/stock/queries";
import type { StockEventType } from "@/features/stock/types";

const EVENT_TYPES: StockEventType[] = [
  "intake",
  "consumption",
  "adjustment",
  "block",
  "unblock",
  "reversal",
];

/**
 * Export CSV al jurnalului de stoc (`/stoc/audit`), respectand filtrele curente.
 * `requireRole` redirectioneaza (nu arunca 403) — suficient aici: ruta e accesata
 * doar din link-ul din UI-ul admin, deja protejat de layout.
 */
export async function GET(request: NextRequest) {
  await requireRole(["admin", "operator"]);

  const { searchParams } = new URL(request.url);
  const itemId = searchParams.get("item_id") || undefined;
  const eventTypeParam = searchParams.get("event_type") ?? "";
  const eventType = (EVENT_TYPES as string[]).includes(eventTypeParam)
    ? (eventTypeParam as StockEventType)
    : undefined;

  const events = await listStockEvents({ itemId, eventType, limit: 5000 });
  const csv = stockEventsToCsv(events);
  const fileName = `audit-stoc-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
