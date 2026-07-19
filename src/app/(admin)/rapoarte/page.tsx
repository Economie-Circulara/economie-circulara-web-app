import type * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import {
  formatDeliveriesReport,
  formatOrdersByStatusReport,
  formatPaasUsageReport,
  formatRecycledMaterialsReport,
  formatReturnsReport,
  formatSecondaryMaterialReport,
} from "@/features/reports/format";
import { REPORT_META, type ReportKey } from "@/features/reports/labels";
import { formatRangeLabel, parseDateRange } from "@/features/reports/period";
import {
  getDeliveriesReport,
  getOrdersByStatusReport,
  getPaasUsageReport,
  getRecycledMaterialsReport,
  getReturnsReport,
  getSecondaryMaterialReport,
} from "@/features/reports/queries";
import { ReportTable } from "@/features/reports/report-table";

export const metadata = { title: "Rapoarte — Lateris Trace" };

interface RapoartePageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

/** Un link de export (PDF/CSV) pentru un raport, cu perioada curenta pastrata in query. */
function ExportLinks({ reportKey, from, to }: { reportKey: ReportKey; from: string; to: string }) {
  const query = `report=${reportKey}&from=${from}&to=${to}`;
  return (
    <div className="flex gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={`/rapoarte/export/pdf?${query}`}>⤓ PDF</a>
      </Button>
      <Button asChild variant="outline" size="sm">
        <a href={`/rapoarte/export/csv?${query}`}>⤓ CSV</a>
      </Button>
    </div>
  );
}

function ReportSection({
  reportKey,
  from,
  to,
  children,
}: {
  reportKey: ReportKey;
  from: string;
  to: string;
  children: React.ReactNode;
}) {
  const meta = REPORT_META[reportKey];
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>{meta.title}</CardTitle>
          <p className="text-sm text-muted-foreground">{meta.description}</p>
        </div>
        <ExportLinks reportKey={reportKey} from={from} to={to} />
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/**
 * Pagina Rapoarte (Task X3, decizie 2026-07) — 6 rapoarte operationale pe perioada
 * selectata, fiecare cu export PDF (antet white-label) + CSV. Vezi formulele exacte in
 * docs/plans/task-x3-rapoarte.md.
 */
export default async function RapoartePage({ searchParams }: RapoartePageProps) {
  await requireRole(["admin", "operator"]);
  const params = await searchParams;
  const range = parseDateRange({ from: params.from, to: params.to });

  const [ordersByStatus, deliveries, returns, recycledMaterials, paasUsage, secondaryMaterial] =
    await Promise.all([
      getOrdersByStatusReport(range),
      getDeliveriesReport(range),
      getReturnsReport(range),
      getRecycledMaterialsReport(range),
      getPaasUsageReport(range),
      getSecondaryMaterialReport(range),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapoarte"
        description={`Rapoarte operaționale pe perioadă (${formatRangeLabel(range)}).`}
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="from" className="text-sm font-medium">
            De la
          </label>
          <Input id="from" name="from" type="date" defaultValue={range.from} className="w-44" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="to" className="text-sm font-medium">
            Până la
          </label>
          <Input id="to" name="to" type="date" defaultValue={range.to} className="w-44" />
        </div>
        <Button type="submit" variant="outline">
          Aplică perioada
        </Button>
      </form>

      <ReportSection reportKey="comenzi" from={range.from} to={range.to}>
        <ReportTable report={formatOrdersByStatusReport(ordersByStatus)} />
      </ReportSection>

      <ReportSection reportKey="livrari" from={range.from} to={range.to}>
        <ReportTable
          report={formatDeliveriesReport(deliveries)}
          emptyMessage="Nicio comandă livrată/închisă în perioada selectată."
        />
      </ReportSection>

      <ReportSection reportKey="retururi" from={range.from} to={range.to}>
        <ReportTable
          report={formatReturnsReport(returns)}
          emptyMessage="Niciun retur/garanție cerut(ă) în perioada selectată."
        />
      </ReportSection>

      <ReportSection reportKey="materiale-reciclate" from={range.from} to={range.to}>
        <ReportTable
          report={formatRecycledMaterialsReport(recycledMaterials)}
          emptyMessage="Niciun lot reciclat/recondiționat/retur intrat în stoc în perioada selectată."
        />
      </ReportSection>

      <ReportSection reportKey="paas-utilizare" from={range.from} to={range.to}>
        <ReportTable
          report={formatPaasUsageReport(paasUsage)}
          emptyMessage="Nicio livrare/returnare de client în perioada selectată."
        />
      </ReportSection>

      <ReportSection reportKey="materii-secundare" from={range.from} to={range.to}>
        <ReportTable
          report={formatSecondaryMaterialReport(secondaryMaterial)}
          emptyMessage="Niciun proces de producție finalizat în perioada selectată."
        />
      </ReportSection>

      <Card className="border-dashed opacity-70">
        <CardHeader>
          <CardTitle className="text-base">CO₂ economisit — în pregătire (v2)</CardTitle>
          <p className="text-sm text-muted-foreground">
            Necesită factori de emisie configurabili per organizație (metodologia rămâne
            responsabilitatea clientului) — vezi{" "}
            <code className="text-xs">docs/analiza-cerere-finantare-client-paas.md</code>. Nu face
            parte din acest task.
          </p>
        </CardHeader>
      </Card>
    </div>
  );
}
