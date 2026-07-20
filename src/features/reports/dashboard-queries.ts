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
  const monthStartDate = currentMonthRange().from;
  const monthStart = startOfDayIso(monthStartDate);

  // "Livrate luna curenta": momentul REAL al livrarii, cu acelasi lant de fallback
  // ca `deliveredAtIso` din calculations.ts (Fix F3) — `delivered_at` lipseste la
  // comenzile livrate inainte de migrarea 0015. `delivery_date` e coloana `date`,
  // deci se compara cu `YYYY-MM-DD`.
  const deliveredThisMonthFilter = [
    `delivered_at.gte.${monthStart}`,
    `and(delivered_at.is.null,delivery_date.gte.${monthStartDate})`,
    `and(delivered_at.is.null,delivery_date.is.null,updated_at.gte.${monthStart})`,
  ].join(",");

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
      .or(deliveredThisMonthFilter),
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
