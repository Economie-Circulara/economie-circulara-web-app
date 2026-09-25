import Link from "next/link";
import { notFound } from "next/navigation";
import { ConfirmActionButton } from "@/components/confirm-action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/features/auth/session";
import {
  confirmOwnDeliveryReceiptAction,
  deleteOwnDraftOrderAction,
} from "@/features/client-portal/actions";
import { ClientDeliveryCard } from "@/features/client-portal/client-delivery-card";
import { getClientOrderDelivery } from "@/features/client-portal/queries";
import { RepeatOrderButton } from "@/features/client-portal/repeat-order-button";
import { ORDER_STATUS_BADGE_STATUS, ORDER_STATUS_LABELS } from "@/features/orders/labels";
import { getOrderDetail } from "@/features/orders/queries";
import { ReturnActions } from "@/features/returns/return-actions";
import { ORDER_LINK_TYPE_LABELS } from "@/features/returns/labels";
import { getReturnLinkForOrder, getReturnableItems } from "@/features/returns/queries";
import { ALLOWED_RETURN_FLOWS_BY_ORDER_TYPE } from "@/features/returns/types";

export const metadata = { title: "Detalii comandă - Lot cu Lot" };

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });
const qtyFormatter = new Intl.NumberFormat("ro-RO");

function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : "-";
}

function isFinished(status: string): boolean {
  return status === "delivered" || status === "closed";
}

/**
 * Detaliul unei comenzi proprii (Task H). `getOrderDetail` e RLS-scoped
 * (`orders_client_select`) - un client care incearca id-ul unei comenzi straine
 * primeste `null` -> 404, fara logica suplimentara de autorizare aici. Nu se
 * afiseaza nimic despre stoc/loturi/procese (doar itemul, UM, cantitatea).
 *
 * Comenzile de tip `aport` (client -> organizatie, initiate din /aport-nou) merg
 * pe alt sens de miscare a stocului decat `material`/`serviciu` - `isIntakeOrder`
 * adapteaza framing-ul (card "Aport" in loc de "Livrare", eticheta datei), in
 * oglinda cu `isIntakeOrder` din /comenzi/[id] (ecranul staff). Nu se afiseaza
 * "Repetă comanda" pe un aport: cosul (`useCart`/`/catalog`) creeaza doar comenzi
 * `material` din catalogul vandabil, deci "repetarea" unui aport ar duce catre un
 * cos care nu poate contine liniile lui (itemi de aport, adesea nevandabili).
 */
export default async function ClientOrderDetailPage({ params }: OrderDetailPageProps) {
  await requireRole(["client"]);
  const { id } = await params;

  const order = await getOrderDetail(id);
  if (!order) notFound();

  const isIntakeOrder = order.orderType === "aport";
  // Cerere de retur/garantie (comanda derivata, `order_links`): produsele vin DE LA
  // client - fara "Repetă comanda" (ar recomanda exact marfa returnata) si fara livrare.
  const returnLink = await getReturnLinkForOrder(order.id);
  const isReturnRequest = returnLink?.linkType === "return" || returnLink?.linkType === "warranty";

  // Retur/garantie: doar pe comenzile finalizate. `getReturnableItems` e RLS-scoped
  // (clientul vede doar comenzile proprii), deci nu e nevoie de autorizare aici.
  // ...si doar pe tipurile de comanda care permit fluxul cerut (migrarea 0030:
  // retur si garantie pe `material`/`serviciu`, nimic pe `aport`).
  const allowedReturnFlows = ALLOWED_RETURN_FLOWS_BY_ORDER_TYPE[order.orderType];
  // Livrarea planificata de staff (0041): exista doar pe comenzi acceptate/livrate,
  // niciodata pe un aport (materialul vine de la client, nu pleaca spre el).
  const [returnableItems, delivery] = await Promise.all([
    isFinished(order.status) && allowedReturnFlows.length > 0
      ? getReturnableItems(order.id)
      : Promise.resolve([]),
    isIntakeOrder || isReturnRequest ? Promise.resolve(null) : getClientOrderDelivery(order.id),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={order.orderNumber ?? "Comandă draft"}
        breadcrumbs={[
          { label: "Comenzile mele", href: "/comenzile-mele" },
          { label: order.orderNumber ?? "Ciornă" },
        ]}
        actions={
          <>
            {order.status === "closed" ? (
              <Button asChild variant="outline">
                <Link href={`/comenzile-mele/${order.id}/certificat`}>Vezi certificat</Link>
              </Button>
            ) : null}
            {isIntakeOrder || isReturnRequest ? null : <RepeatOrderButton items={order.items} />}
            {/* Doar ciornele proprii se pot sterge (migrarea 0035). */}
            {order.status === "draft" ? (
              <ConfirmActionButton
                triggerLabel="Șterge ciorna"
                title="Ștergi această ciornă?"
                description="Ciorna nu a fost trimisă, deci organizația nu a primit-o. După ștergere nu mai apare în lista ta de comenzi."
                confirmLabel="Da, șterge ciorna"
                pendingLabel="Se șterge..."
                action={deleteOwnDraftOrderAction.bind(null, order.id)}
              />
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge group="order" status={ORDER_STATUS_BADGE_STATUS[order.status]} />
        {returnLink ? (
          <span className="text-sm text-muted-foreground">
            {ORDER_LINK_TYPE_LABELS[returnLink.linkType]} pentru{" "}
            <Link href={`/comenzile-mele/${returnLink.originalOrderId}`} className="underline">
              comanda originală
            </Link>
          </span>
        ) : null}
      </div>

      <div className={delivery ? "grid gap-4 lg:grid-cols-2" : undefined}>
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
            {order.notes ? (
              <p>
                <span className="text-muted-foreground">Observații: </span>
                {order.notes}
              </p>
            ) : null}
          </CardContent>
        </Card>
        {delivery ? (
          <ClientDeliveryCard
            delivery={delivery}
            confirmAction={
              order.status === "accepted" && !delivery.receivedAt
                ? confirmOwnDeliveryReceiptAction.bind(null, order.id)
                : undefined
            }
          />
        ) : null}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          {isIntakeOrder
            ? "Materiale aduse"
            : isReturnRequest
              ? "Produse returnate"
              : "Produse comandate"}
        </h2>
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

      {isFinished(order.status) && returnableItems.some((i) => i.returnableQuantity > 0) ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Retur / Garanție</h2>
          <ReturnActions
            originalOrderId={order.id}
            returnableItems={returnableItems}
            allowedFlows={allowedReturnFlows}
            redirectBasePath="/comenzile-mele"
          />
        </section>
      ) : null}
    </div>
  );
}
