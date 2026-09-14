import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { requireRole } from "@/features/auth/session";
import { DeliveryActionsPanel } from "@/features/deliveries/delivery-actions-panel";
import { getDeliveryDetail } from "@/features/deliveries/queries";
import { ReceiptForm } from "@/features/deliveries/receipt-form";
import { RoutePanel } from "@/features/deliveries/route-panel";
import { getCurrentOrg } from "@/features/auth/queries";
import { renderStoredRouteStaticMapDataUrl } from "@/features/routing/route-service";
import type { RouteOption } from "@/features/routing/types";

export const metadata = { title: "Detalii livrare - Lot cu Lot" };

interface DeliveryDetailPageProps {
  params: Promise<{ id: string }>;
}

const dateFormatter = new Intl.DateTimeFormat("ro-RO");
const qtyFormatter = new Intl.NumberFormat("ro-RO");

/**
 * Ecranul de detaliu al unei livrari (Task X5): transport + ruta, aviz PDF
 * descarcabil, declarare/reincercare e-Transport (cod UIT). Doar staff.
 */
export default async function DeliveryDetailPage({ params }: DeliveryDetailPageProps) {
  await requireRole(["admin", "operator"]);
  const { id } = await params;

  const delivery = await getDeliveryDetail(id);
  if (!delivery) notFound();

  const org = await getCurrentOrg();
  const mapDataUrl = delivery.route.alternatives
    ? await renderStoredRouteStaticMapDataUrl({
        routes: delivery.route.alternatives as unknown as RouteOption[],
        selectedIndex: delivery.route.selectedIndex ?? 0,
        recommendedColor: org?.primaryColor,
      })
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Livrare - ${delivery.orderNumber ?? "Draft"}`}
        description={delivery.clientName}
        breadcrumbs={[
          { label: "Livrări", href: "/livrari" },
          { label: "Comenzi", href: "/comenzi" },
          { label: delivery.orderNumber ?? "Comandă", href: `/comenzi/${delivery.orderId}` },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transport</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Data programată: </span>
              {dateFormatter.format(new Date(delivery.scheduledDate))}
            </p>
            <p>
              <span className="text-muted-foreground">Transportator: </span>
              {delivery.carrierName}
            </p>
            <p>
              <span className="text-muted-foreground">Vehicul: </span>
              {delivery.vehiclePlate}
            </p>
            <p>
              <span className="text-muted-foreground">Șofer: </span>
              {delivery.driverName}
            </p>
            <p>
              <span className="text-muted-foreground">Rută: </span>
              {delivery.routeOrigin} {"->"} {delivery.routeDestination}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Declarare RO e-Transport</CardTitle>
          </CardHeader>
          <CardContent>
            <DeliveryActionsPanel
              deliveryId={delivery.id}
              declarationStatus={delivery.declarationStatus}
              uitCode={delivery.uitCode}
              declarationError={delivery.declarationError}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rută (planificare optimizată)</CardTitle>
          </CardHeader>
          <CardContent>
            <RoutePanel
              deliveryId={delivery.id}
              distanceMeters={delivery.route.distanceMeters}
              durationSeconds={delivery.route.durationSeconds}
              mapDataUrl={mapDataUrl}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Confirmarea recepției</CardTitle>
          </CardHeader>
          <CardContent>
            <ReceiptForm
              deliveryId={delivery.id}
              receivedAt={delivery.receipt.receivedAt}
              receivedByName={delivery.receipt.receivedByName}
              receiptNotes={delivery.receipt.receiptNotes}
            />
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Materiale transportate</h2>
        {delivery.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Comanda nu are linii.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {delivery.items.map((item, index) => (
              <li
                key={`${item.itemId}-${index}`}
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

      <p className="text-sm text-muted-foreground">
        <Link href={`/comenzi/${delivery.orderId}`} className="underline">
          Vezi comanda originală
        </Link>
      </p>
    </div>
  );
}
