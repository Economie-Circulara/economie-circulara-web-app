import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/features/auth/session";
import { PROCESS_STATUS_BADGE_STATUS, PROCESS_TYPE_LABELS } from "@/features/production/labels";
import {
  PROVENANCE_BADGE_STATUS,
  QUALITY_LABELS,
  STOCK_EVENT_LABELS,
  lotBadgeStatus,
} from "@/features/stock/labels";
import { getLotById, getLotTraceability, listStockEvents } from "@/features/stock/queries";

export const metadata = { title: "Detaliu lot - Lot cu Lot" };

interface LotDetailPageProps {
  params: Promise<{ id: string }>;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO");
const dateTimeFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" });

function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

function formatDateTime(iso: string): string {
  return dateTimeFormatter.format(new Date(iso));
}

/**
 * Ecranul de detaliu lot (doar staff) - identificarea unui lot ("un id pentru
 * identificare", cerinta utilizatorului) + trasabilitate. Doua sectiuni:
 *   - Trasabilitate directa (un hop): procesul care a produs lotul / procesele
 *     care l-au consumat (`getLotTraceability`) - fiecare link duce mai departe
 *     la Sankey-ul COMPLET al acelui proces (`/productie/[id]`), fara sa
 *     duplicam aici graful recursiv din certificates/traceability.ts (acela e
 *     construit special pentru loturile livrate pe o comanda, nu pentru un lot
 *     arbitrar - vezi comentariul din queries.ts#getLotTraceability).
 *   - Istoric miscari: jurnalul `stock_events` filtrat pe acest lot, cronologic -
 *     varianta simpla, suficienta pentru "ce s-a intamplat cu lotul asta".
 */
export default async function LotDetailPage({ params }: LotDetailPageProps) {
  await requireRole(["admin", "operator"]);
  const { id } = await params;

  const lot = await getLotById(id);
  if (!lot) notFound();

  const [traceability, events] = await Promise.all([
    getLotTraceability(id),
    listStockEvents({ lotId: id }),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={lot.lotCode}
        description={lot.itemTitle}
        breadcrumbs={[{ label: "Stoc", href: "/stoc" }, { label: lot.lotCode }]}
        actions={
          <StatusBadge group="lot" status={lotBadgeStatus(lot.isBlocked)} />
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalii lot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Material: </span>
              {lot.itemTitle}
            </p>
            <p>
              <span className="text-muted-foreground">Proveniență: </span>
              <StatusBadge group="provenance" status={PROVENANCE_BADGE_STATUS[lot.provenance]} />
            </p>
            {lot.source ? (
              <p>
                <span className="text-muted-foreground">Sursă: </span>
                {lot.source}
              </p>
            ) : null}
            <p>
              <span className="text-muted-foreground">Data intrare: </span>
              {formatDate(lot.entryDate)}
            </p>
            {lot.location ? (
              <p>
                <span className="text-muted-foreground">Locație: </span>
                {lot.location}
              </p>
            ) : null}
            <p>
              <span className="text-muted-foreground">Cantitate: </span>
              <span className="font-medium tabular-nums">
                {lot.remainingQty} / {lot.initialQty} {lot.unit}
              </span>{" "}
              <span className="text-xs text-muted-foreground">(rămasă / inițială)</span>
            </p>
            <p>
              <span className="text-muted-foreground">Calitate: </span>
              {QUALITY_LABELS[lot.qualityStatus]}
            </p>
            {lot.isBlocked ? (
              <p>
                <span className="text-muted-foreground">Motiv blocare: </span>
                {lot.blockReason}
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Trasabilitate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {lot.clientName ? (
              <p>
                <span className="text-muted-foreground">Adus de client: </span>
                {lot.clientName}
              </p>
            ) : null}

            <div>
              <p className="text-muted-foreground">Provine din:</p>
              {traceability.producedBy ? (
                <Link
                  href={`/productie/${traceability.producedBy.processId}`}
                  className="flex items-center gap-2 underline"
                >
                  {PROCESS_TYPE_LABELS[traceability.producedBy.type]}
                  <StatusBadge
                    group="process"
                    status={PROCESS_STATUS_BADGE_STATUS[traceability.producedBy.status]}
                  />
                </Link>
              ) : (
                <p>Intrare directă în stoc (fără proces anterior).</p>
              )}
            </div>

            <div>
              <p className="text-muted-foreground">Consumat în:</p>
              {traceability.consumedBy.length === 0 ? (
                <p>Nefolosit încă în niciun proces.</p>
              ) : (
                <ul className="space-y-1">
                  {traceability.consumedBy.map((link) => (
                    <li key={link.processId}>
                      <Link
                        href={`/productie/${link.processId}`}
                        className="flex items-center gap-2 underline"
                      >
                        {PROCESS_TYPE_LABELS[link.type]}
                        <StatusBadge
                          group="process"
                          status={PROCESS_STATUS_BADGE_STATUS[link.status]}
                        />
                        <span className="text-xs text-muted-foreground">
                          ({link.quantity} {lot.unit})
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Istoric mișcări</h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">Niciun eveniment înregistrat pentru acest lot.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Timp</th>
                  <th className="px-4 py-2 font-medium">Utilizator</th>
                  <th className="px-4 py-2 font-medium">Acțiune</th>
                  <th className="px-4 py-2 font-medium">Delta</th>
                  <th className="px-4 py-2 font-medium">Motiv</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr key={event.id} className="border-b last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs">
                      {formatDateTime(event.createdAt)}
                    </td>
                    <td className="px-4 py-2">{event.createdByName ?? "-"}</td>
                    <td className="px-4 py-2">{STOCK_EVENT_LABELS[event.eventType]}</td>
                    <td className="px-4 py-2 font-mono font-medium tabular-nums">
                      {event.quantity > 0 ? "+" : ""}
                      {event.quantity}
                    </td>
                    <td className="px-4 py-2">{event.reason ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
