import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";
import type { OrderStatus } from "@/features/orders/types";
import { getEmailProvider, type EmailProvider } from "./provider";
import { notificationTypeForOrderStatus, renderOrderStatusEmail } from "./templates";
import type { NotificationRecord, NotificationType } from "./types";

type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];
type AdminClient = ReturnType<typeof createAdminClient>;

/** Sender implicit cand organizatia nu are configurat email_from_name/email_from_address (T1.3 white-label). */
const DEFAULT_FROM_NAME = "Lateris Trace";
const DEFAULT_FROM_ADDRESS = "notificari@lateristrace.app";

/** Evenimentul minim necesar trimiterii unei notificari de tranzitie de status. */
export interface OrderStatusNotificationEvent {
  orderId: string;
  organizationId: string;
  clientId: string;
  toStatus: OrderStatus;
}

export interface SendOrderStatusNotificationResult {
  notification: NotificationRecord;
  /** `false` daca providerul de email a eșuat (randul ramane `failed`, jurnalizat). */
  sent: boolean;
}

/** Comanda nu a putut fi gasita — nimic de notificat (defensiv, nu ar trebui sa apara in flux normal). */
export class NotificationOrderNotFoundError extends Error {
  constructor(public readonly orderId: string) {
    super("Comanda nu a putut fi găsită pentru trimiterea notificării.");
    this.name = "NotificationOrderNotFoundError";
  }
}

/** Clientul comenzii nu are o adresa de email configurata — nu exista destinatar. */
export class NotificationRecipientMissingError extends Error {
  constructor(public readonly orderId: string) {
    super("Clientul comenzii nu are o adresă de email configurată.");
    this.name = "NotificationRecipientMissingError";
  }
}

function mapNotification(row: NotificationRow): NotificationRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    recipientEmail: row.recipient_email,
    type: row.type,
    subject: row.subject,
    body: row.body,
    relatedOrderId: row.related_order_id,
    status: row.status,
    error: row.error,
    createdAt: row.created_at,
    sentAt: row.sent_at,
  };
}

interface OrderContextForEmail {
  orderNumber: string | null;
  clientName: string;
  clientEmail: string | null;
  organizationName: string;
  fromName: string;
  fromAddress: string;
}

/**
 * Incarca datele necesare randarii/trimiterii emailului (numar comanda, nume+email
 * client, sender white-label al organizatiei) folosind clientul ADMIN. Alegere
 * deliberata fata de clientul legat de sesiune (ca in certificates/service.ts):
 * acest serviciu ruleaza DUPA ce tranzitia de status a fost deja autorizata de
 * action-ul apelant (`requireRole` in orders/actions.ts) — nu mai are nevoie de o
 * a doua verificare RLS, si ramane corect indiferent de contextul de
 * sesiune/cookie al apelantului (hook intern, nu un ecran expus direct).
 */
async function loadOrderContext(
  admin: AdminClient,
  orderId: string,
): Promise<OrderContextForEmail> {
  const { data, error } = await admin
    .from("orders")
    .select(
      "order_number, clients(name, email), organizations(name, email_from_name, email_from_address)",
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error) throw new Error("Nu am putut încărca comanda pentru notificare.");
  if (!data) throw new NotificationOrderNotFoundError(orderId);

  return {
    orderNumber: data.order_number,
    clientName: data.clients?.name ?? "client",
    clientEmail: data.clients?.email ?? null,
    organizationName: data.organizations?.name ?? DEFAULT_FROM_NAME,
    fromName: data.organizations?.email_from_name ?? DEFAULT_FROM_NAME,
    fromAddress: data.organizations?.email_from_address ?? DEFAULT_FROM_ADDRESS,
  };
}

/**
 * Notificarea deja trimisa cu succes pt. aceeasi comanda+tip (idempotenta
 * rezonabila — cerinta task): daca hook-ul ar rula de doua ori pt. aceeasi
 * tranzitie, nu retrimitem un al doilea email, doar returnam randul existent.
 */
async function findAlreadySent(
  admin: AdminClient,
  orderId: string,
  type: NotificationType,
): Promise<NotificationRecord | null> {
  const { data } = await admin
    .from("notifications")
    .select("*")
    .eq("related_order_id", orderId)
    .eq("type", type)
    .eq("status", "sent")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? mapNotification(data) : null;
}

/**
 * Trimite notificarea prin email pt. o tranzitie de status a unei comenzi.
 * Apelata din `orders/notifications.ts#onOrderStatusChanged` la fiecare
 * tranzitie (alaturi de generarea certificatului la `closed`, Task G — vezi
 * acel fisier).
 *
 * Pasi: 1) rezolva tipul de notificare din statusul tinta (`null` -> no-op,
 * `draft` nu se notifica niciodata); 2) idempotenta (`findAlreadySent`); 3)
 * incarca datele comenzii; 4) randeaza template-ul (functie pura,
 * `renderOrderStatusEmail`); 5) insereaza randul `notifications` (`queued`);
 * 6) apeleaza providerul de email (`getEmailProvider()` implicit — mock in
 * dev/teste, HTTP API daca sunt setate `EMAIL_API_URL`/`EMAIL_API_KEY`); 7)
 * actualizeaza randul la `sent`/`failed`.
 *
 * NU arunca daca DOAR providerul de email eșuează — marcheaza randul `failed`
 * si intoarce `{ sent: false }`; apelantul ramane responsabil doar de
 * jurnalizare (tranzitia comenzii, deja persistata, nu trebuie intrerupta de
 * o eroare de livrare a emailului). Erorile de date (comanda/client
 * inexistent/fara email) SUNT aruncate — indica o problema de configurare, nu
 * o eroare tranzitorie a providerului.
 */
export async function sendOrderStatusNotification(
  event: OrderStatusNotificationEvent,
  provider: EmailProvider = getEmailProvider(),
): Promise<SendOrderStatusNotificationResult | null> {
  const type = notificationTypeForOrderStatus(event.toStatus);
  if (!type) return null;

  const admin = createAdminClient();

  const alreadySent = await findAlreadySent(admin, event.orderId, type);
  if (alreadySent) return { notification: alreadySent, sent: true };

  const context = await loadOrderContext(admin, event.orderId);
  if (!context.clientEmail) throw new NotificationRecipientMissingError(event.orderId);

  const rendered = renderOrderStatusEmail(
    {
      orderNumber: context.orderNumber,
      clientName: context.clientName,
      organizationName: context.organizationName,
    },
    event.toStatus,
  );

  const { data: inserted, error: insertError } = await admin
    .from("notifications")
    .insert({
      organization_id: event.organizationId,
      recipient_email: context.clientEmail,
      type,
      subject: rendered.subject,
      body: rendered.html,
      related_order_id: event.orderId,
      status: "queued",
    })
    .select("*")
    .single();

  if (insertError || !inserted) {
    throw new Error("Nu am putut salva notificarea.");
  }

  try {
    await provider.send({
      to: context.clientEmail,
      from: { name: context.fromName, address: context.fromAddress },
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Eroare necunoscută la trimiterea emailului.";
    const { data: failedRow } = await admin
      .from("notifications")
      .update({ status: "failed", error: message })
      .eq("id", inserted.id)
      .select("*")
      .single();
    return {
      notification: mapNotification(failedRow ?? { ...inserted, status: "failed", error: message }),
      sent: false,
    };
  }

  const { data: sentRow } = await admin
    .from("notifications")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("id", inserted.id)
    .select("*")
    .single();

  return {
    notification: mapNotification(sentRow ?? { ...inserted, status: "sent" }),
    sent: true,
  };
}
