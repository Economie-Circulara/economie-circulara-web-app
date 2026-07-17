import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { requireRole } from "@/features/auth/session";
import { ORDER_STATUS_LABELS, ORDER_STATUS_OPTIONS } from "@/features/orders/labels";
import { OrderTable } from "@/features/orders/order-table";
import { listOrders } from "@/features/orders/queries";
import type { OrderStatus } from "@/features/orders/types";

export const metadata = { title: "Comenzi — Lateris Trace" };

const selectClassName =
  "flex h-9 w-48 rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none";

interface ComenziPageProps {
  searchParams: Promise<{ status?: string; q?: string }>;
}

/** Ecranul Comenzi — lista comenzilor organizației (doar staff), cu filtre status + căutare. */
export default async function ComenziPage({ searchParams }: ComenziPageProps) {
  await requireRole(["admin", "operator"]);
  const params = await searchParams;

  const statusParam = params.status ?? "";
  const status = (ORDER_STATUS_OPTIONS as string[]).includes(statusParam)
    ? (statusParam as OrderStatus)
    : undefined;
  const search = params.q?.trim() || undefined;

  const orders = await listOrders({ status, search });
  const hasFilters = Boolean(status || search);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comenzi"
        description="Comenzile clienților — status, produse și acțiuni rapide."
        actions={
          <Button asChild>
            <Link href="/comenzi/nou">+ Comandă nouă</Link>
          </Button>
        }
      />

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="q" className="text-sm font-medium">
            Căutare
          </label>
          <Input
            id="q"
            name="q"
            defaultValue={search ?? ""}
            placeholder="Client sau număr comandă..."
            className="w-64"
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="status" className="text-sm font-medium">
            Status
          </label>
          <select id="status" name="status" defaultValue={status ?? ""} className={selectClassName}>
            <option value="">Toate</option>
            {ORDER_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {ORDER_STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" variant="outline">
          Filtrează
        </Button>
        {hasFilters ? (
          <Button asChild variant="ghost">
            <Link href="/comenzi">Resetează</Link>
          </Button>
        ) : null}
      </form>

      <OrderTable orders={orders} />
    </div>
  );
}
