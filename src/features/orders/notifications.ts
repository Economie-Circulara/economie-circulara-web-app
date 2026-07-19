import { generateCertificateForOrder } from "@/features/certificates/service";
import { sendOrderStatusNotification } from "@/features/notifications/service";
import type { OrderStatus } from "./types";

export interface OrderStatusChangedEvent {
  orderId: string;
  organizationId: string;
  clientId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
}

/**
 * Hook apelat DUPA fiecare tranzitie de status reusita a unei comenzi (vezi
 * `actions.ts`).
 *
 * La FIECARE tranzitie, trimite notificarea de email catre client (Task X1,
 * `sendOrderStatusNotification` — vezi `features/notifications/service.ts`):
 * randeaza template-ul RO pt. statusul tinta, insereaza randul `notifications`
 * si apeleaza providerul de email (mock in dev/teste, HTTP API daca e
 * configurat). O eroare la trimiterea notificarii (provider jos, date de
 * configurare lipsa etc.) NU trebuie sa anuleze tranzitia de status deja
 * persistata — se jurnalizeaza si atat, la fel ca la certificat mai jos.
 *
 * La `toStatus === 'closed'`, genereaza automat si certificatul de
 * trasabilitate (Task G, AGENTS.md §4: "Certificatul PDF se genereaza automat
 * la inchiderea comenzii"). `generateCertificateForOrder` e IDEMPOTENT
 * (`certificates.order_id` e UNIQUE) — sigur de apelat chiar daca hook-ul ar
 * rula de doua ori pentru aceeasi comanda. O eroare la generarea
 * certificatului (ex. PDF/storage) NU trebuie sa anuleze tranzitia de status
 * deja persistata (comanda ramane `closed` — starea comenzii e sursa de
 * adevar, nu efectul secundar) — se jurnalizeaza si atat; certificatul poate
 * fi regenerat manual ulterior daca e nevoie (nu exista inca un buton de
 * regenerare — in afara scope-ului Task G).
 */
export async function onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
  console.info(
    `[orders] status schimbat: comanda=${event.orderId} ${event.fromStatus} -> ${event.toStatus}`,
  );

  try {
    await sendOrderStatusNotification({
      orderId: event.orderId,
      organizationId: event.organizationId,
      clientId: event.clientId,
      toStatus: event.toStatus,
    });
  } catch (err) {
    console.error(`[orders] trimiterea notificarii a eșuat pentru comanda ${event.orderId}:`, err);
  }

  if (event.toStatus === "closed") {
    try {
      await generateCertificateForOrder(event.orderId);
    } catch (err) {
      console.error(
        `[orders] generarea certificatului a eșuat pentru comanda ${event.orderId}:`,
        err,
      );
    }
  }
}
