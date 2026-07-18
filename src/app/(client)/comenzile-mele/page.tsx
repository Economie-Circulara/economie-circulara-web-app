import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { OrderList } from "@/features/client-portal/order-list";
import { listOrders } from "@/features/orders/queries";

export const metadata = { title: "Comenzile mele — Lateris Trace" };

/**
 * Ecranul „Comenzile mele": `listOrders()` fara filtru suplimentar — RLS
 * (`orders_client_select`, 0003_rls_hardening.sql) limiteaza deja rezultatul la
 * comenzile firmei clientului curent.
 */
export default async function ComenzileMelePage() {
  await requireRole(["client"]);
  const orders = await listOrders();

  return (
    <div className="space-y-4">
      <PageHeader title="Comenzile mele" description="Comenzile trimise către organizație." />
      <OrderList orders={orders} />
    </div>
  );
}
