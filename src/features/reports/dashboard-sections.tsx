import Link from "next/link";
import type * as React from "react";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleAlert,
  ClipboardPlus,
  Factory,
  FileCheck2,
  LockKeyhole,
  PackageCheck,
  PackagePlus,
  ShoppingCart,
  Truck,
} from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ORDER_STATUS_BADGE_STATUS } from "@/features/orders/labels";
import { cn } from "@/lib/utils";
import { DashboardStockChart } from "./dashboard-stock-chart";
import type { OperationalDashboardData } from "./types";

/**
 * Sectiunile panoului de control (Task X3), extrase din pagina ca sa poata fi
 * ARANJATE diferit per organizare (`organizations.layout`, plan
 * multi-domain-tenant-profiles T4). Fiecare sectiune primeste datele deja incarcate
 * si un `className` pentru pozitia in grila.
 */

const numberFormatter = new Intl.NumberFormat("ro-RO");

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  hint: string;
  href: string;
}

function KpiCard({ label, value, icon: Icon, hint, href }: KpiCardProps) {
  return (
    <Link
      href={href}
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
          <Icon className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold tabular-nums">{numberFormatter.format(value)}</p>
          <p className="mt-1 text-xs text-muted-foreground group-hover:text-foreground">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

interface SectionProps {
  dashboard: OperationalDashboardData;
  className?: string;
}

export function KpiRow({ dashboard, className }: SectionProps) {
  const { kpis } = dashboard;
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      <KpiCard
        label="Comenzi active"
        value={kpis.activeOrders}
        icon={ShoppingCart}
        hint="Trimise, acceptate sau livrate"
        href="/comenzi"
      />
      <KpiCard
        label="De acceptat"
        value={kpis.ordersToAccept}
        icon={CheckCircle2}
        hint="Comenzi trimise, în așteptare"
        href="/comenzi?status=sent"
      />
      <KpiCard
        label="Livrate luna aceasta"
        value={kpis.deliveredThisMonth}
        icon={PackageCheck}
        hint="Comenzi livrate în luna curentă"
        href="/comenzi?status=delivered"
      />
      <KpiCard
        label="Fișe de trasabilitate emise"
        value={kpis.certificatesIssued}
        icon={FileCheck2}
        hint="Total, de la începutul activității"
        href="/rapoarte"
      />
    </div>
  );
}

export function StockTrendCard({ dashboard, className }: SectionProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Evoluția stocului</CardTitle>
          <p className="text-sm text-muted-foreground">
            Nivel disponibil la finalul fiecărei zile, ultimele 14 zile.
          </p>
        </div>
        <Link href="/stoc" className="text-sm font-medium text-primary hover:underline">
          Vezi stocul
        </Link>
      </CardHeader>
      <CardContent>
        <DashboardStockChart trends={dashboard.stockTrends} />
      </CardContent>
    </Card>
  );
}

export function AttentionCard({ dashboard, className }: SectionProps) {
  const { kpis } = dashboard;
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Necesită atenție</CardTitle>
          <p className="text-sm text-muted-foreground">Semnale pentru următoarea acțiune.</p>
        </div>
        <CircleAlert className="size-5 text-warn" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Link
          href="/comenzi?status=sent"
          className="flex items-center justify-between rounded-md bg-warn-bg p-3 text-sm transition-colors hover:brightness-95"
        >
          <span>
            <strong>{numberFormatter.format(kpis.ordersToAccept)}</strong>{" "}
            {kpis.ordersToAccept === 1 ? "comandă așteaptă" : "comenzi așteaptă"} acceptarea
          </span>
          <ArrowRight className="size-4 text-warn" />
        </Link>
        {dashboard.blockedLots > 0 ? (
          <Link
            href="/stoc"
            className="flex items-center justify-between rounded-md bg-danger-bg p-3 text-sm transition-colors hover:brightness-95"
          >
            <span className="inline-flex items-center gap-2">
              <LockKeyhole className="size-4 text-danger" />
              <strong>{numberFormatter.format(dashboard.blockedLots)}</strong>{" "}
              {dashboard.blockedLots === 1 ? "lot blocat" : "loturi blocate"}
            </span>
            <ArrowRight className="size-4 text-danger" />
          </Link>
        ) : null}
        {dashboard.lowStockItems.length > 0 ? (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Stoc de verificat · sub 20%
            </p>
            {dashboard.lowStockItems.map((item) => (
              <Link
                key={item.itemId}
                href="/stoc"
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-secondary"
              >
                <span className="min-w-0 truncate font-medium">{item.itemTitle}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {numberFormatter.format(item.remainingQty)} {item.unit} ·{" "}
                  {item.availabilityPercent}%
                </span>
              </Link>
            ))}
          </div>
        ) : dashboard.blockedLots === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nu sunt alerte de stoc în acest moment.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function RecentOrdersCard({ dashboard, className }: SectionProps) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div className="space-y-1">
          <CardTitle>Ultimele comenzi</CardTitle>
          <p className="text-sm text-muted-foreground">
            Cele mai recent actualizate comenzi ale organizației.
          </p>
        </div>
        <Link href="/comenzi" className="text-sm font-medium text-primary hover:underline">
          Toate comenzile
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {dashboard.recentOrders.length > 0 ? (
          dashboard.recentOrders.map((order) => (
            <Link
              key={order.id}
              href={`/comenzi/${order.id}`}
              className="flex items-center justify-between gap-3 rounded-md px-2 py-2.5 hover:bg-secondary"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {order.orderNumber ?? "Comandă fără număr"}
                </p>
                <p className="truncate text-xs text-muted-foreground">{order.clientName}</p>
              </div>
              <StatusBadge group="order" status={ORDER_STATUS_BADGE_STATUS[order.status]} />
            </Link>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Nu există comenzi încă.</p>
        )}
      </CardContent>
    </Card>
  );
}

export function ReportsCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Rapoarte operaționale</CardTitle>
        <p className="text-sm text-muted-foreground">
          Comenzi, livrări, retururi și materiale secundare, cu export PDF/CSV.
        </p>
      </CardHeader>
      <CardContent>
        <Link
          href="/rapoarte"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
        >
          <BarChart3 className="size-4" />
          Vezi rapoarte
          <ArrowRight className="size-4" />
        </Link>
      </CardContent>
    </Card>
  );
}

const QUICK_ACTIONS = [
  { href: "/comenzi/nou", label: "Comandă nouă", icon: ClipboardPlus },
  { href: "/productie/nou", label: "Pornește un proces", icon: Factory },
  { href: "/stoc/nou", label: "Adaugă lot în stoc", icon: PackagePlus },
  { href: "/livrari/nou", label: "Planifică o livrare", icon: Truck },
  { href: "/rapoarte", label: "Rapoarte", icon: BarChart3 },
];

/** Scurtaturi catre fluxurile zilnice - folosite de organizarea `flux`. */
export function QuickActionsCard({ className }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Acțiuni rapide</CardTitle>
        <p className="text-sm text-muted-foreground">Pornește direct fluxurile de zi cu zi.</p>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <Icon className="size-4 shrink-0 text-primary" />
            {label}
            <ArrowRight className="ml-auto size-4 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
