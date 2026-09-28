import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { getCurrentOrg } from "@/features/auth/queries";
import { requireRole } from "@/features/auth/session";
import { LAYOUTS, resolveLayoutKey } from "@/features/branding/layouts";
import { getOperationalDashboard } from "@/features/reports/dashboard-queries";
import {
  AttentionCard,
  KpiRow,
  QuickActionsCard,
  RecentOrdersCard,
  ReportsCard,
  StockTrendCard,
} from "@/features/reports/dashboard-sections";

export async function generateMetadata(): Promise<Metadata> {
  const org = await getCurrentOrg();
  return { title: LAYOUTS[resolveLayoutKey(org?.layout)].dashboardTitle };
}

/**
 * Dashboard admin/operator (Task X3) - carduri KPI din mockup, cu date reale ale
 * tenantului curent (RLS). Formulele exacte in docs/plans/task-x3-rapoarte.md §2.
 *
 * Aranjamentul depinde de organizarea organizatiei (`organizations.layout`, T4):
 *  - `standard` - indicatori sus, apoi grafic de stoc + alerte, ultimele comenzi;
 *  - `flux` - incepe cu ce e de facut (alerte + actiuni rapide), apoi comenzile si
 *    indicatorii, graficul la final.
 */
export default async function DashboardPage() {
  await requireRole(["admin", "operator"]);
  const [dashboard, org] = await Promise.all([getOperationalDashboard(), getCurrentOrg()]);
  const layout = resolveLayoutKey(org?.layout);

  if (layout === "flux") {
    return (
      <div className="space-y-6">
        <PageHeader
          title={LAYOUTS.flux.dashboardTitle}
          description="Ce e de făcut azi, comenzile în lucru și starea stocului."
        />

        <div className="grid gap-6 xl:grid-cols-5">
          <AttentionCard dashboard={dashboard} className="xl:col-span-3" />
          <QuickActionsCard className="xl:col-span-2" />
        </div>

        <div className="grid gap-6 lg:grid-cols-5">
          <RecentOrdersCard dashboard={dashboard} className="lg:col-span-3" />
          <KpiRow dashboard={dashboard} className="lg:col-span-2 lg:grid-cols-2" />
        </div>

        <StockTrendCard dashboard={dashboard} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={LAYOUTS.standard.dashboardTitle}
        description="Priorități, stoc și activitatea recentă — într-un singur loc."
      />

      <KpiRow dashboard={dashboard} />

      <div className="grid gap-6 xl:grid-cols-5">
        <StockTrendCard dashboard={dashboard} className="xl:col-span-3" />
        <AttentionCard dashboard={dashboard} className="xl:col-span-2" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <RecentOrdersCard dashboard={dashboard} className="lg:col-span-3" />
        <ReportsCard className="lg:col-span-2" />
      </div>
    </div>
  );
}
