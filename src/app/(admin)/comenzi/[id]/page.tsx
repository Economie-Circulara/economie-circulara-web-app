import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { getCertificateByOrderId } from "@/features/certificates/service";
import { getDeliveryByOrderId } from "@/features/deliveries/queries";
import { AcceptIntakeButton } from "@/features/orders/accept-intake-button";
import { deleteDraftOrderAction } from "@/features/orders/actions";
import {
  ORDER_STATUS_LABELS,
  ORDER_TYPE_DESCRIPTIONS,
  ORDER_TYPE_LABELS,
} from "@/features/orders/labels";
import { OrderStatusActions } from "@/features/orders/order-status-actions";
import {
  APORT_JOURNEY,
  INTAKE_JOURNEY,
  OrderStatusTimeline,
} from "@/features/orders/order-status-timeline";
import { getOrderDetail } from "@/features/orders/queries";
import { canAcceptIntake } from "@/features/orders/state-machine";
import { AcceptReturnButton } from "@/features/returns/accept-return-button";
import { ORDER_LINK_TYPE_LABELS } from "@/features/returns/labels";
import { getReturnableItems, getReturnLinkForOrder } from "@/features/returns/queries";
import { ReturnActions } from "@/features/returns/return-actions";
import { ALLOWED_RETURN_FLOWS_BY_ORDER_TYPE } from "@/features/returns/types";

export const metadata = { title: "Detalii comandă - Lot cu Lot" };

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO");
const qtyFormatter = new Intl.NumberFormat("ro-RO");

function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : "-";
}

/** Ecranul de detaliu comandă (doar staff): client, livrare, linii, istoric status. */
export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  await requireRole(["admin", "operator"]);
  const { id } = await params;

  const order = await getOrderDetail(id);
  if (!order) notFound();

  // Certificatul se genereaza automat la inchidere (hook in orders/notifications.ts,
  // Task G) - verificam daca exista deja ca sa afisam link-ul de vizualizare/descarcare.
  const certificate = order.status === "closed" ? await getCertificateByOrderId(id) : null;

  // Task F (Retur & Garanție & Închiriere): daca aceasta comanda e ea insași o
  // comanda-retur/garanție (are o legatura `order_links` catre o comanda
  // originala), ascundem tranzițiile generice (`OrderStatusActions` e gandit pt.
  // comenzi de vanzare - "Acceptă" acolo CONSUMA stoc, gresit pt. un retur) si
  // aratam in loc butonul dedicat `AcceptReturnButton`. Altfel, daca e o comanda
  // finalizata (delivered/closed), oferim butoanele Retur/Garanție.
  // Task X5 (Livrari & e-Transport): planificarea livrarii se face pe o comanda
  // acceptata, in ecranul dedicat /livrari/nou (nu inline aici - vezi acel ecran).
  const delivery = await getDeliveryByOrderId(id);

  // Comanda de tip `aport` (migrarea 0030) NU parcurge masina de stari de vanzare:
  // "Acceptă aport" (din draft sau sent - trimis din portal, 0042) creste stocul
  // (`accept_intake_order`) si o lasa in `accepted`; altfel se poate doar anula.
  const isIntakeOrder = order.orderType === "aport";

  const returnLink = await getReturnLinkForOrder(id);
  // "replacement" (comanda de inlocuire la garanție) e o comanda de vanzare
  // obișnuită - parcurge fluxul normal (send/accept/deliver/close); doar
  // "return"/"warranty" au acceptare dedicata (creeaza stoc, nu-l consuma).
  const isReturnOrder = returnLink?.linkType === "return" || returnLink?.linkType === "warranty";
  // Fluxurile retur/garantie depind acum SI de tipul comenzii (vezi
  // ALLOWED_RETURN_FLOWS_BY_ORDER_TYPE): retur si garantie pe `material`/
  // `serviciu`, nimic pe `aport`.
  const allowedReturnFlows = ALLOWED_RETURN_FLOWS_BY_ORDER_TYPE[order.orderType];
  const returnableItems =
    !returnLink &&
    allowedReturnFlows.length > 0 &&
    (order.status === "delivered" || order.status === "closed")
      ? await getReturnableItems(id)
      : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={order.orderNumber ?? "Comandă draft"}
        description={order.clientName}
        breadcrumbs={[
          { label: "Comenzi", href: "/comenzi" },
          { label: order.orderNumber ?? "Ciornă" },
        ]}
        actions={
          <>
            {order.status === "draft" ? (
              <>
                <Button asChild variant="outline">
                  <Link href={`/comenzi/${order.id}/edit`}>Editează</Link>
                </Button>
                {/* Doar ciornele se sterg (migrarea 0035); restul se anuleaza. */}
                <ConfirmActionButton
                  triggerLabel="Șterge ciorna"
                  title="Ștergi această ciornă de comandă?"
                  description="Ciorna va dispărea din listă. Nu s-a mișcat nimic din stoc, deci nu se pierde nicio informație de trasabilitate. Acțiunea nu poate fi anulată din aplicație."
                  confirmLabel="Da, șterge ciorna"
                  pendingLabel="Se șterge..."
                  action={deleteDraftOrderAction.bind(null, order.id)}
                />
              </>
            ) : null}
            {certificate ? (
              <Button asChild variant="outline">
                <Link href={`/comenzi/${order.id}/certificat`}>Vezi certificat</Link>
              </Button>
            ) : null}
            {delivery ? (
              <Button asChild variant="outline">
                <Link href={`/livrari/${delivery.id}`}>Vezi livrare</Link>
              </Button>
            ) : order.status === "accepted" && !isIntakeOrder ? (
              <Button asChild variant="outline">
                <Link href={`/livrari/nou?orderId=${order.id}`}>Planifică livrare</Link>
              </Button>
            ) : null}
            {isIntakeOrder ? (
              <>
                {canAcceptIntake(order.status) ? <AcceptIntakeButton orderId={order.id} /> : null}
                <OrderStatusActions orderId={order.id} status={order.status} orderType="aport" />
              </>
            ) : isReturnOrder ? (
              order.status === "draft" ? (
                <AcceptReturnButton returnOrderId={order.id} />
              ) : null
            ) : (
              <>
                <OrderStatusActions
                  orderId={order.id}
                  status={order.status}
                  delivery={
                    delivery ? { id: delivery.id, receivedAt: delivery.receipt.receivedAt } : null
                  }
                />
                {returnableItems.length > 0 ? (
                  <ReturnActions
                    originalOrderId={order.id}
                    returnableItems={returnableItems}
                    allowedFlows={allowedReturnFlows}
                  />
                ) : null}
              </>
            )}
          </>
        }
      />

      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">{ORDER_TYPE_LABELS[order.orderType]}</span> -{" "}
        {ORDER_TYPE_DESCRIPTIONS[order.orderType]}
      </p>

      {returnLink ? (
        <p className="text-sm text-muted-foreground">
          {ORDER_LINK_TYPE_LABELS[returnLink.linkType]} pentru{" "}
          <Link href={`/comenzi/${returnLink.originalOrderId}`} className="underline">
            comanda originală
          </Link>
          .
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Client</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p className="font-medium">{order.clientName}</p>
            <p className="text-muted-foreground">CUI {order.clientCui}</p>
            {order.createdByAdmin ? (
              <p className="text-xs text-muted-foreground">
                Creată de organizație în numele clientului.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{isIntakeOrder ? "Aport" : "Livrare"}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Adresă: </span>
              {order.deliveryAddress
                ? `${order.deliveryAddressLabel ? `${order.deliveryAddressLabel} - ` : ""}${order.deliveryAddress}`
                : "Neprecizată"}
            </p>
            <p>
              <span className="text-muted-foreground">
                {isIntakeOrder ? "Data aportului: " : "Data livrare: "}
              </span>
              {formatDate(order.deliveryDate)}
            </p>
            {order.expectedReturnDate ? (
              <p>
                <span className="text-muted-foreground">Retur estimat (închiriere): </span>
                {formatDate(order.expectedReturnDate)}
              </p>
            ) : null}
            {order.notes ? (
              <p>
                <span className="text-muted-foreground">Note: </span>
                {order.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Linii comandă</h2>
        {order.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Comanda nu are linii.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {order.items.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 px-4 py-2 text-sm"
              >
                <span>{item.itemTitle}</span>
                <span className="font-mono tabular-nums">
                  {qtyFormatter.format(item.quantity)} {item.unit}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Istoric status</h2>
        <OrderStatusTimeline
          status={order.status}
          journey={isIntakeOrder ? APORT_JOURNEY : isReturnOrder ? INTAKE_JOURNEY : undefined}
        />
        <p className="text-xs text-muted-foreground">
          Status curent: {ORDER_STATUS_LABELS[order.status]}.
        </p>
      </section>
    </div>
  );
}
