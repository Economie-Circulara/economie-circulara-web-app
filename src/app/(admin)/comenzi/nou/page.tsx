import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { listClients } from "@/features/clients/queries";
import { OrderForm } from "@/features/orders/order-form";
import { listClientAddressesGrouped, listSellableItemOptions } from "@/features/orders/queries";

export const metadata = { title: "Comandă nouă — Lateris Trace" };

/** Ecranul de creare comandă în numele unui client (doar staff, `created_by_admin=true`). */
export default async function ComandaNouaPage() {
  await requireRole(["admin", "operator"]);

  const [clients, addressesByClient, itemOptions] = await Promise.all([
    listClients(),
    listClientAddressesGrouped(),
    listSellableItemOptions(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Comandă nouă"
        description="Creează o comandă în numele unui client."
        breadcrumbs={[{ label: "Comenzi", href: "/comenzi" }, { label: "Comandă nouă" }]}
      />
      <OrderForm
        clients={clients}
        addressesByClient={addressesByClient}
        itemOptions={itemOptions}
      />
    </div>
  );
}
