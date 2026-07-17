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
 * `actions.ts`). Implementare goala/log acum — Task X1 (notificari) inlocuieste
 * corpul cu trimitere efectiva (email/in-app catre client + staff), consumand
 * exact acest eveniment.
 *
 * La `toStatus === 'closed'`, acesta e si punctul de intrare pentru generarea
 * certificatului de trasabilitate (Task G): certificatul se genereaza automat la
 * inchiderea comenzii (AGENTS.md §4). Nu se implementeaza aici — doar hook-ul,
 * apelat sincron dupa tranzitie, e pregatit pentru ca Task G sa branseze logica
 * (construire snapshot trasabilitate + PDF + Storage) fara sa mai atinga
 * `actions.ts`.
 */
export async function onOrderStatusChanged(event: OrderStatusChangedEvent): Promise<void> {
  // TODO(Task X1): emite evenimentul de notificare (email/in-app) catre client + staff.
  // TODO(Task G): la toStatus === 'closed', declanseaza generarea certificatului de
  // trasabilitate pentru event.orderId.
  console.info(
    `[orders] status schimbat: comanda=${event.orderId} ${event.fromStatus} -> ${event.toStatus}`,
  );
}
