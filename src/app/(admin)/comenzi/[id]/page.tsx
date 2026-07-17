import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireRole } from "@/features/auth/session";
import { ORDER_STATUS_BADGE_STATUS, ORDER_STATUS_LABELS } from "@/features/orders/labels";
import { OrderStatusActions } from "@/features/orders/order-status-actions";
import { getOrderDetail } from "@/features/orders/queries";

export const metadata = { title: "Detalii comandă — Lateris Trace" };

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO");
const qtyFormatter = new Intl.NumberFormat("ro-RO");

function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : "—";
}

/**
 * Istoricul de status afisat aici e derivat din masina de stari (nu exista inca un
 * tabel dedicat de audit al tranzitiilor) — arata pozitia curenta pe traseul
 * draft -> trimisă -> acceptată -> livrată -> închisă, sau „Anulată” daca a fost
 * intrerupt. Un istoric cu marcaje de timp per tranzitie ar necesita un tabel nou,
 * in afara scope-ului acestui task (schema 0001 e inghetata).
 */
const ORDER_JOURNEY: readonly ("draft" | "sent" | "accepted" | "delivered" | "closed")[] = [
  "draft",
  "sent",
  "accepted",
  "delivered",
  "closed",
];

/** Ecranul de detaliu comandă (doar staff): client, livrare, linii, istoric status. */
export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  await requireRole(["admin", "operator"]);
  const { id } = await params;

  const order = await getOrderDetail(id);
  if (!order) notFound();

  const isCancelled = order.status === "cancelled";
  const currentStepIndex = ORDER_JOURNEY.indexOf(order.status as (typeof ORDER_JOURNEY)[number]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={order.orderNumber ?? "Comandă draft"}
        description={order.clientName}
        breadcrumbs={[
          { label: "Comenzi", href: "/comenzi" },
          { label: order.orderNumber ?? "Draft" },
        ]}
        actions={<OrderStatusActions orderId={order.id} status={order.status} />}
      />

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
        {isCancelled ? (
          <div className="flex items-center gap-2">
            <StatusBadge group="order" status={ORDER_STATUS_BADGE_STATUS.cancelled} />
            <span className="text-sm text-muted-foreground">
              Comanda a fost anulată din traseul normal.
            </span>
          </div>
        ) : (
          <ol className="flex flex-wrap items-center gap-2">
            {ORDER_JOURNEY.map((step, index) => {
              const reached = index <= currentStepIndex;
              return (
                <li key={step} className="flex items-center gap-2">
                  {index > 0 ? <span className="text-muted-foreground">→</span> : null}
                  <span className={reached ? "" : "opacity-40"}>
                    <StatusBadge group="order" status={ORDER_STATUS_BADGE_STATUS[step]} />
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <p className="text-xs text-muted-foreground">
          Status curent: {ORDER_STATUS_LABELS[order.status]}.
        </p>
      </section>
    </div>
  );
}
