import { createClient } from "@/lib/supabase/server";
import { currentMonthRange, startOfDayIso } from "./period";
import type { DashboardKpis } from "./types";

/**
 * KPI-urile de pe dashboard (Task X3 §2) — 4 numarari Supabase in paralel
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
