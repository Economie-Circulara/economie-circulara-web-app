import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireRole } from "@/features/auth/session";
import { getProcessById } from "@/features/production/queries";
import { PROCESS_STATUS_BADGE_STATUS, PROCESS_TYPE_LABELS } from "@/features/production/labels";
import { SankeyDiagram } from "@/features/production/sankey-diagram";
import { buildProcessSankeyData } from "@/features/production/sankey-data";
import { computeLoss } from "@/features/production/calc";
import { CancelProcessButton } from "@/features/production/cancel-process-button";
import { PROVENANCE_LABELS } from "@/features/stock/labels";

export const metadata = { title: "Detaliu proces — Lateris Trace" };

interface ProcessDetailPageProps {
  params: Promise<{ id: string }>;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" });

function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : "—";
}

const NON_TERMINAL_STATUSES = new Set(["planned", "in_progress", "awaiting_confirmation"]);

/** Detaliul unui proces — Sankey (loturi input → proces → loturi output) + trasabilitate. */
export default async function ProcessDetailPage({ params }: ProcessDetailPageProps) {
  await requireRole(["admin", "operator"]);
  const { id } = await params;

  const process = await getProcessById(id);
  if (!process) notFound();

  const sankeyData = buildProcessSankeyData(process, PROCESS_TYPE_LABELS[process.type]);
  const loss = computeLoss(process.totalInputQty, process.totalOutputQty);
  const canCancel = NON_TERMINAL_STATUSES.has(process.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Proces — ${process.outputItemTitle}`}
        breadcrumbs={[
          { label: "Producție", href: "/productie" },
          { label: process.outputItemTitle },
        ]}
        description={PROCESS_TYPE_LABELS[process.type]}
        actions={
          <div className="flex items-center gap-3">
            <StatusBadge group="process" status={PROCESS_STATUS_BADGE_STATUS[process.status]} />
            {canCancel ? <CancelProcessButton processId={process.id} /> : null}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Flux materiale</CardTitle>
        </CardHeader>
        <CardContent>
          <SankeyDiagram data={sankeyData} height={280} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inputuri (loturi consumate)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {process.inputs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Niciun input înregistrat.</p>
            ) : (
              process.inputs.map((line, i) => (
                <div
                  key={`${line.lotId}-${i}`}
                  className="flex justify-between border-t pt-2 text-sm first:border-t-0 first:pt-0"
                >
                  <span>{line.itemTitle}</span>
                  <span className="font-mono tabular-nums">
                    {line.quantity} {line.unit}
                  </span>
                </div>
              ))
            )}
            <div className="flex justify-between border-t pt-2 text-sm font-semibold">
              <span>Total input</span>
              <span className="font-mono tabular-nums">{process.totalInputQty}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Outputuri (loturi create)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {process.outputs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Niciun output înregistrat.</p>
            ) : (
              process.outputs.map((line, i) => (
                <div
                  key={`${line.lotId}-${i}`}
                  className="flex justify-between border-t pt-2 text-sm first:border-t-0 first:pt-0"
                >
                  <span>
                    {line.itemTitle}
                    {line.provenance ? (
                      <span className="ml-2 text-xs text-muted-foreground">
                        ({PROVENANCE_LABELS[line.provenance]})
                      </span>
                    ) : null}
                  </span>
                  <span className="font-mono tabular-nums">
                    {line.quantity} {line.unit}
                  </span>
                </div>
              ))
            )}
            <div className="flex justify-between border-t pt-2 text-sm font-semibold">
              <span>Total output</span>
              <span className="font-mono tabular-nums">{process.totalOutputQty}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Randament / pierderi</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="text-muted-foreground">
            Diferența input − output este informativă (se înregistrează, nu se validează).
          </p>
          <p>
            Pierdere (masă): <span className="font-mono font-semibold tabular-nums">{loss}</span>
          </p>
          <p className="text-muted-foreground">
            Pornit: {formatDate(process.startedAt)} · Finalizat: {formatDate(process.completedAt)}
          </p>
          {process.notes ? <p className="text-muted-foreground">Note: {process.notes}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
