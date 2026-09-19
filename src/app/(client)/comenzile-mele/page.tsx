import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { OrderList } from "@/features/client-portal/order-list";
import { listOrders } from "@/features/orders/queries";

export const metadata = { title: "Comenzile mele - Lot cu Lot" };

/**
 * Ecranul "Comenzile mele": `listOrders()` fara filtru suplimentar - RLS
 * (`orders_client_select`, 0003_rls_hardening.sql) limiteaza deja rezultatul la
 * comenzile firmei clientului curent. Lista include si aporturile (comenzi de tip
 * `aport`, initiate de client din /aport-nou) - fara filtru pe tip, aceeasi lista
 * unica pentru toate tipurile de comanda.
 */
export default async function ComenzileMelePage() {
  await requireRole(["client"]);
  const orders = await listOrders();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Comenzile mele"
        description="Comenzile trimise către organizație."
        actions={
          <Button asChild variant="outline">
            <Link href="/aport-nou">Cerere aport material</Link>
          </Button>
        }
      />
      <OrderList orders={orders} />
    </div>
  );
}
