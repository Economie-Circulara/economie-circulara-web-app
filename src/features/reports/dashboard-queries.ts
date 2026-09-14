import { createClient } from "@/lib/supabase/server";
import { currentMonthRange, startOfDayIso } from "./period";
import { buildStockTrends, findLowStockItems } from "./dashboard-calculations";
import type { DashboardKpis, OperationalDashboardData } from "./types";

/**
 * KPI-urile de pe dashboard (Task X3 §2) - 4 numarari Supabase in paralel
 * (`count: "exact", head: true`, fara sa aduca randurile). Formulele exacte sunt
 * documentate in docs/plans/task-x3-rapoarte.md §2.
 */
export async function getDashboardKpis(): Promise<DashboardKpis> {
  const supabase = await createClient();
  const monthStart = startOfDayIso(currentMonthRange().from);

  const [activeRes, toAcceptRes, deliveredRes, certificatesRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["sent", "accepted", "delivered"]),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("status", "sent"),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "delivered")
      .gte("updated_at", monthStart),
    supabase.from("certificates").select("id", { count: "exact", head: true }),
  ]);

  for (const res of [activeRes, toAcceptRes, deliveredRes, certificatesRes]) {
    if (res.error) throw new Error("Nu am putut încărca indicatorii de dashboard.");
  }

  return {
    activeOrders: activeRes.count ?? 0,
    ordersToAccept: toAcceptRes.count ?? 0,
    deliveredThisMonth: deliveredRes.count ?? 0,
    certificatesIssued: certificatesRes.count ?? 0,
  };
}

function dashboardTrendStart(days: number, now = new Date()): string {
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  date.setUTCDate(date.getUTCDate() - days + 1);
  return date.toISOString();
}

/**
 * Datele care transforma dashboardul intr-o lista scurta de prioritati operationale.
 * Toate query-urile ruleaza pe clientul sesiunii, deci RLS pastreaza izolarea tenantului.
 */
export async function getOperationalDashboard(): Promise<OperationalDashboardData> {
  const supabase = await createClient();
  const trendDays = 14;
  const now = new Date();
  const [kpis, lotsRes, ordersRes, eventsRes] = await Promise.all([
    getDashboardKpis(),
    supabase
      .from("lots")
      .select("item_id, initial_qty, remaining_qty, is_blocked, items(title, unit)"),
    supabase
      .from("orders")
      .select("id, order_number, status, updated_at, clients(name)")
      .order("updated_at", { ascending: false })
      .limit(6),
    supabase
      .from("stock_events")
      .select("created_at, quantity, items(unit)")
      .gte("created_at", dashboardTrendStart(trendDays, now))
      .order("created_at", { ascending: true }),
  ]);

  for (const result of [lotsRes, ordersRes, eventsRes]) {
    if (result.error) throw new Error("Nu am putut încărca datele operaționale de dashboard.");
  }

  const lots = (lotsRes.data ?? []).map((lot) => ({
    itemId: lot.item_id,
    itemTitle: lot.items?.title ?? "Item fără denumire",
    unit: lot.items?.unit ?? "unități",
    initialQty: Number(lot.initial_qty),
    remainingQty: Number(lot.remaining_qty),
    isBlocked: lot.is_blocked,
  }));

  return {
    kpis,
    recentOrders: (ordersRes.data ?? []).map((order) => ({
      id: order.id,
      orderNumber: order.order_number,
      clientName: order.clients?.name ?? "Client neprecizat",
      status: order.status,
      updatedAt: order.updated_at,
    })),
    lowStockItems: findLowStockItems(lots).slice(0, 5),
    blockedLots: lots.filter((lot) => lot.isBlocked).length,
    stockTrends: buildStockTrends(
      lots,
      (eventsRes.data ?? []).map((event) => ({
        createdAt: event.created_at,
        quantity: Number(event.quantity),
        unit: event.items?.unit ?? "unități",
      })),
      now,
      trendDays,
    ),
  };
}
