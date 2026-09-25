import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { ClientReceiptFormState } from "./action-state";
import { ConfirmReceiptForm } from "./confirm-receipt-form";
import type { ClientOrderDelivery } from "./types";

const dateFormatter = new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" });
const dateTimeFormatter = new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "medium",
  timeStyle: "short",
});

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      {value}
    </p>
  );
}

/**
 * Cardul "Transport" din /comenzile-mele/[id]: livrarea planificata de staff, doar
 * campurile expuse clientului de RPC-ul `client_order_delivery` (0041).
 */
export function ClientDeliveryCard({
  delivery,
  confirmAction,
}: {
  delivery: ClientOrderDelivery;
  /**
   * Doar pe o comanda `accepted` cu receptie neconfirmata: clientul confirma el
   * receptia (0045). Lipsa -> fara formular.
   */
  confirmAction?: (
    prev: ClientReceiptFormState,
    formData: FormData,
  ) => Promise<ClientReceiptFormState>;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Transport</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        <Row
          label="Data programată"
          value={dateFormatter.format(new Date(delivery.scheduledDate))}
        />
        <Row label="Transportator" value={delivery.carrierName} />
        <Row label="Vehicul" value={delivery.vehiclePlate} />
        <Row label="Șofer" value={delivery.driverName} />
        <Row label="Destinație" value={delivery.destination} />
        {delivery.uitCode ? <Row label="Cod UIT (e-Transport)" value={delivery.uitCode} /> : null}
        <Row
          label="Recepție"
          value={
            delivery.receivedAt
              ? `confirmată${delivery.receivedByName ? ` de ${delivery.receivedByName}` : ""}, ${dateTimeFormatter.format(new Date(delivery.receivedAt))}`
              : "neconfirmată"
          }
        />
        {confirmAction && !delivery.receivedAt ? (
          <ConfirmReceiptForm action={confirmAction} />
        ) : null}
      </CardContent>
    </Card>
  );
}
