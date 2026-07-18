import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/features/auth/session";
import { RepeatOrderButton } from "@/features/client-portal/repeat-order-button";
import { ORDER_STATUS_BADGE_STATUS, ORDER_STATUS_LABELS } from "@/features/orders/labels";
import { getOrderDetail } from "@/features/orders/queries";
import { ReturnActions } from "@/features/returns/return-actions";
import { getReturnableItems } from "@/features/returns/queries";

export const metadata = { title: "Detalii comandă — Lateris Trace" };

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });
const qtyFormatter = new Intl.NumberFormat("ro-RO");

function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : "—";
}

function isFinished(status: string): boolean {
  return status === "delivered" || status === "closed";
}

/**
 * Detaliul unei comenzi proprii (Task H). `getOrderDetail` e RLS-scoped
 * (`orders_client_select`) — un client care incearca id-ul unei comenzi straine
 * primeste `null` -> 404, fara logica suplimentara de autorizare aici. Nu se
 * afiseaza nimic despre stoc/loturi/procese (doar itemul, UM, cantitatea).
 */
export default async function ClientOrderDetailPage({ params }: OrderDetailPageProps) {
  await requireRole(["client"]);
  const { id } = await params;

  const order = await getOrderDetail(id);
  if (!order) notFound();

  // Retur/garantie: doar pe comenzile finalizate. `getReturnableItems` e RLS-scoped
  // (clientul vede doar comenzile proprii), deci nu e nevoie de autorizare aici.
  const returnableItems = isFinished(order.status) ? await getReturnableItems(order.id) : [];

  return (
    <div className="space-y-8">
      <PageHeader
        title={order.orderNumber ?? "Comandă draft"}
        breadcrumbs={[
          { label: "Comenzile mele", href: "/comenzile-mele" },
          { label: order.orderNumber ?? "Draft" },
        ]}
        actions={
          <>
            {order.status === "closed" ? (
              <Button asChild variant="outline">
                <Link href={`/comenzile-mele/${order.id}/certificat`}>Vezi certificat</Link>
              </Button>
            ) : null}
            <RepeatOrderButton items={order.items} />
          </>
        }
      />

      <div className="flex items-center gap-2">
        <StatusBadge group="order" status={ORDER_STATUS_BADGE_STATUS[order.status]} />
        <span className="text-sm text-muted-foreground">{ORDER_STATUS_LABELS[order.status]}</span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Livrare</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p>
            <span className="text-muted-foreground">Adresă: </span>
            {order.deliveryAddress
              ? `${order.deliveryAddressLabel ? `${order.deliveryAddressLabel} — ` : ""}${order.deliveryAddress}`
              : "Neprecizată"}
          </p>
          <p>
            <span className="text-muted-foreground">Data livrare: </span>
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

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Produse comandate</h2>
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
            redirectBasePath="/comenzile-mele"
          />
        </section>
      ) : null}
    </div>
  );
}
