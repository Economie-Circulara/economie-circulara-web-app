import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { requireRole } from "@/features/auth/session";
import { AuditTable } from "@/features/stock/audit-table";
import { STOCK_EVENT_LABELS } from "@/features/stock/labels";
import { listItemOptions, listStockEvents } from "@/features/stock/queries";
import type { StockEventType } from "@/features/stock/types";

export const metadata = { title: "Audit stoc — Lateris Trace" };

const selectClassName =
  "flex h-9 w-56 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none";

const EVENT_TYPES: StockEventType[] = [
  "intake",
  "consumption",
  "adjustment",
  "block",
  "unblock",
  "reversal",
];

interface AuditPageProps {
  searchParams: Promise<{ item_id?: string; event_type?: string }>;
}

/** Ecranul Audit stoc — jurnalul `stock_events` (doar staff), cu export CSV. */
export default async function AuditPage({ searchParams }: AuditPageProps) {
  await requireRole(["admin", "operator"]);
  const params = await searchParams;

  const itemId = params.item_id || undefined;
  const eventTypeParam = params.event_type ?? "";
  const eventType = (EVENT_TYPES as string[]).includes(eventTypeParam)
    ? (eventTypeParam as StockEventType)
    : undefined;

  const [events, items] = await Promise.all([
    listStockEvents({ itemId, eventType }),
    listItemOptions(),
  ]);

  const exportQuery = new URLSearchParams();
  if (itemId) exportQuery.set("item_id", itemId);
  if (eventType) exportQuery.set("event_type", eventType);
  const exportHref = `/stoc/audit/export${exportQuery.size ? `?${exportQuery.toString()}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit stoc"
        description="Jurnalul tuturor mișcărilor de stoc — intrări, consum, ajustări, blocări."
        breadcrumbs={[{ label: "Stoc", href: "/stoc" }, { label: "Audit" }]}
        actions={
          <Button asChild variant="outline">
            <a href={exportHref}>⤓ Exportă CSV</a>
          </Button>
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="item_id" className="text-sm font-medium">
            Item
          </label>
          <select
            id="item_id"
            name="item_id"
            defaultValue={itemId ?? ""}
            className={selectClassName}
          >
            <option value="">Toți itemii</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="event_type" className="text-sm font-medium">
            Tip eveniment
          </label>
          <select
            id="event_type"
            name="event_type"
            defaultValue={eventType ?? ""}
            className={selectClassName}
          >
            <option value="">Toate</option>
            {EVENT_TYPES.map((type) => (
              <option key={type} value={type}>
                {STOCK_EVENT_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Filtrează
        </Button>
        {itemId || eventType ? (
          <Button asChild variant="ghost">
            <Link href="/stoc/audit">Resetează</Link>
          </Button>
        ) : null}
      </form>

      <AuditTable events={events} />
    </div>
  );
}
