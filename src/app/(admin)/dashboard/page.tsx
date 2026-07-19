import Link from "next/link";
import type * as React from "react";
import { BarChart3, CheckCircle2, FileCheck2, PackageCheck, ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { getDashboardKpis } from "@/features/reports/dashboard-queries";

export const metadata = { title: "Dashboard — Lateris Trace" };

const numberFormatter = new Intl.NumberFormat("ro-RO");

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
}

function KpiCard({ label, value, icon: Icon, hint }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold tabular-nums">{numberFormatter.format(value)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

/**
 * Dashboard admin/operator (Task X3) — carduri KPI din mockup, cu date reale ale
 * tenantului curent (RLS). Formulele exacte in docs/plans/task-x3-rapoarte.md §2.
 */
export default async function DashboardPage() {
  await requireRole(["admin", "operator"]);
  const kpis = await getDashboardKpis();

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Privire de ansamblu asupra activitatii." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Comenzi active"
          value={kpis.activeOrders}
          icon={ShoppingCart}
          hint="Trimise, acceptate sau livrate"
        />
        <KpiCard
          label="De acceptat"
          value={kpis.ordersToAccept}
          icon={CheckCircle2}
          hint="Comenzi trimise, în așteptare"
        />
        <KpiCard
          label="Livrate luna aceasta"
          value={kpis.deliveredThisMonth}
          icon={PackageCheck}
          hint="Comenzi livrate în luna curentă"
        />
        <KpiCard
          label="Certificate emise"
          value={kpis.certificatesIssued}
          icon={FileCheck2}
          hint="Total, de la începutul activității"
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle>Rapoarte operaționale</CardTitle>
            <p className="text-sm text-muted-foreground">
              Comenzi, livrări, retururi, materiale reciclate și rapoartele de conformitate PaaS, pe
              orice perioadă — cu export PDF/CSV.
            </p>
          </div>
          <Link
            href="/rapoarte"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <BarChart3 className="size-4" />
            Vezi rapoarte
          </Link>
        </CardHeader>
      </Card>
    </div>
  );
}
