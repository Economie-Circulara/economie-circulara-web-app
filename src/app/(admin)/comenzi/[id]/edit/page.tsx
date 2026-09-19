import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { listClients } from "@/features/clients/queries";
import { OrderEditForm } from "@/features/orders/order-edit-form";
import type { OrderEditorValue } from "@/features/orders/order-editor";
import {
  getOrderDetail,
  listClientAddressesGrouped,
  listIntakeItemOptions,
  listSellableItemOptions,
} from "@/features/orders/queries";

export const metadata = { title: "Editează comandă - Lot cu Lot" };

interface EditOrderPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Ecranul de editare a unei comenzi `draft` existente (doar staff) - reutilizeaza
 * `OrderEditor`, precompletat din comanda existenta, prin `OrderEditForm`. O
 * comanda care nu mai e `draft` (deja inaintata etc.) nu poate fi editata -
 * redirect direct la ecranul de detaliu (`updateOrder` in service.ts re-verifica
 * oricum, server-side, ca ultima linie de aparare).
 */
export default async function EditOrderPage({ params }: EditOrderPageProps) {
  await requireRole(["admin", "operator"]);
  const { id } = await params;

  const order = await getOrderDetail(id);
  if (!order) notFound();
  if (order.status !== "draft") redirect(`/comenzi/${id}`);

  const [clients, addressesByClient, itemOptions, intakeItemOptions] = await Promise.all([
    listClients(),
    listClientAddressesGrouped(),
    listSellableItemOptions(),
    listIntakeItemOptions(),
  ]);

  const initialValue: OrderEditorValue = {
    orderType: order.orderType,
    clientId: order.clientId,
    deliveryAddressId: order.deliveryAddressId ?? "",
    deliveryDate: order.deliveryDate ?? "",
    expectedReturnDate: order.expectedReturnDate ?? "",
    notes: order.notes ?? "",
    lines: order.items.map((item) => ({
      key: item.id,
      itemId: item.itemId,
      quantity: item.quantity,
    })),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Editează comanda"
        description={`${order.orderNumber ?? "Comandă draft"} · ${order.clientName}`}
        breadcrumbs={[
          { label: "Comenzi", href: "/comenzi" },
          { label: order.orderNumber ?? "Draft", href: `/comenzi/${id}` },
          { label: "Editează" },
        ]}
      />
      <OrderEditForm
        orderId={id}
        clients={clients}
        addressesByClient={addressesByClient}
        itemOptions={itemOptions}
        intakeItemOptions={intakeItemOptions}
        initialValue={initialValue}
      />
    </div>
  );
}
