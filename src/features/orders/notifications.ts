import { generateCertificateForOrder } from "@/features/certificates/service";
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
 * `actions.ts`). Implementare goala/log pt. notificari — Task X1 va inlocui
 * corpul cu trimitere efectiva (email/in-app catre client + staff), consumand
 * exact acest eveniment.
 *
 * La `toStatus === 'closed'`, genereaza automat certificatul de trasabilitate
 * (Task G, AGENTS.md §4: "Certificatul PDF se genereaza automat la inchiderea
 * comenzii"). `generateCertificateForOrder` e IDEMPOTENT (`certificates.order_id`
 * e UNIQUE) — sigur de apelat chiar daca hook-ul ar rula de doua ori pentru
 * aceeasi comanda. O eroare la generarea certificatului (ex. PDF/storage) NU
 * trebuie sa anuleze tranzitia de status deja persistata (comanda ramane
 * `closed` — starea comenzii e sursa de adevar, nu efectul secundar) — se
 * jurnalizeaza si atat; certificatul poate fi regenerat manual ulterior daca e
 * nevoie (nu exista inca un buton de regenerare — in afara scope-ului Task G).
 */
export async function onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
  // TODO(Task X1): emite evenimentul de notificare (email/in-app) catre client + staff.
  console.info(
    `[orders] status schimbat: comanda=${event.orderId} ${event.fromStatus} -> ${event.toStatus}`,
  );

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
