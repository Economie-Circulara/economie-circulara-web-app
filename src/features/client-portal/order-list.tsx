import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { ORDER_STATUS_BADGE_STATUS } from "@/features/orders/labels";
import type { OrderListRow } from "@/features/orders/types";

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });

function formatDate(iso: string | null): string {
  return iso ? dateFormatter.format(new Date(iso)) : "—";
}

/** `true` pentru comenzile finalizate (retur/garanție au sens doar dupa livrare). */
function isFinished(status: OrderListRow["status"]): boolean {
  return status === "delivered" || status === "closed";
}

/**
 * Ecranul „Comenzile mele" (mockup #COMENZILE MELE): o comanda per card — status,
 * produse, data, actiuni. „Repetă comanda" traieste pe ecranul de detaliu (are
 * nevoie de liniile complete cu `itemId`, nu doar de rezumatul text din aceasta
 * lista) — de aici doar link catre detaliu + acces rapid la certificat/retur.
 */
export function OrderList({ orders }: { orders: OrderListRow[] }) {
  if (orders.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart />}
        title="Nicio comandă"
        description="Comenzile trimise din catalog apar aici."
      />
    );
  }

  return (
    <div className="flex max-w-4xl flex-col gap-3.5">
      {orders.map((order) => (
        <Card key={order.id} className="p-4.5 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5">
                <Link
                  href={`/comenzile-mele/${order.id}`}
                  className="font-mono text-sm font-bold hover:underline"
                >
                  {order.orderNumber ?? "Draft"}
                </Link>
                <StatusBadge group="order" status={ORDER_STATUS_BADGE_STATUS[order.status]} />
              </div>
              <p className="mt-1.5 text-sm font-semibold">{order.itemsSummary}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDate(order.deliveryDate)}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {order.status === "closed" ? (
                <Button asChild size="sm">
                  <Link href={`/comenzile-mele/${order.id}/certificat`}>Certificat ⤓</Link>
                </Button>
              ) : null}
              {isFinished(order.status) ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/comenzile-mele/${order.id}`}>Retur / Garanție</Link>
                </Button>
              ) : null}
              <Button asChild size="sm" variant="ghost">
                <Link href={`/comenzile-mele/${order.id}`}>Detalii</Link>
              </Button>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
