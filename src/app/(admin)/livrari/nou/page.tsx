import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { DeliveryForm } from "@/features/deliveries/delivery-form";
import { getDeliveryByOrderId } from "@/features/deliveries/queries";
import { getOrderDetail } from "@/features/orders/queries";

export const metadata = { title: "Planifică livrare — Lateris Trace" };

interface LivrareNouaPageProps {
  searchParams: Promise<{ orderId?: string }>;
}

/**
 * Ecranul de planificare livrare (Task X5) — pornit din butonul „Planifică
 * livrare" al detaliului comenzii (`/comenzi/[id]`), cu `orderId` in query string.
 * Doar comenzile ACCEPTATE, fara o livrare deja planificata, pot fi programate aici
 * (validarea de business ramane oricum si in `service.ts#planDelivery`, a doua
 * linie de aparare) — altfel afisam un mesaj clar in loc de formular.
 */
export default async function LivrareNouaPage({ searchParams }: LivrareNouaPageProps) {
  await requireRole(["admin", "operator"]);
  const { orderId } = await searchParams;
  if (!orderId) notFound();

  const order = await getOrderDetail(orderId);
  if (!order) notFound();

  const existing = await getDeliveryByOrderId(orderId);
  if (existing) redirect(`/livrari/${existing.id}`);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Planifică livrare"
        description={`${order.orderNumber ?? "Draft"} · ${order.clientName}`}
        breadcrumbs={[
          { label: "Comenzi", href: "/comenzi" },
          { label: order.orderNumber ?? "Comandă", href: `/comenzi/${order.id}` },
          { label: "Planifică livrare" },
        ]}
      />

      {order.status !== "accepted" ? (
        <p className="text-sm text-danger">
          Doar comenzile acceptate pot avea o livrare planificată (status curent: {order.status}).
          Întoarce-te la{" "}
          <Link href={`/comenzi/${order.id}`} className="underline">
            detaliul comenzii
          </Link>
          .
        </p>
      ) : (
        <DeliveryForm
          orderId={order.id}
          orderNumber={order.orderNumber}
          clientName={order.clientName}
        />
      )}
    </div>
  );
}
