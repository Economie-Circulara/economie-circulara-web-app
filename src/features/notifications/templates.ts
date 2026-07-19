import type { OrderStatus } from "@/features/orders/types";
import type { NotificationType } from "./types";

/** Datele minime necesare randarii unui email de status comanda (RO). */
export interface OrderEmailData {
  orderNumber: string | null;
  clientName: string;
  organizationName: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Statusurile care declanseaza o notificare (toate in afara de `draft`, care e
 * intern — nicio actiune din src/features/orders/actions.ts nu emite
 * `onOrderStatusChanged` cu `toStatus: 'draft'`).
 */
type NotifiableOrderStatus = Exclude<OrderStatus, "draft">;

function isNotifiableStatus(status: OrderStatus): status is NotifiableOrderStatus {
  return status !== "draft";
}

const NOTIFICATION_TYPE_BY_STATUS: Record<NotifiableOrderStatus, NotificationType> = {
  sent: "order_sent",
  accepted: "order_accepted",
  delivered: "order_delivered",
  closed: "order_closed",
  cancelled: "order_cancelled",
};

/** Tipul de notificare corespunzator unei tranzitii de status, `null` daca statusul (`draft`) nu se notifica. */
export function notificationTypeForOrderStatus(status: OrderStatus): NotificationType | null {
  return isNotifiableStatus(status) ? NOTIFICATION_TYPE_BY_STATUS[status] : null;
}

function orderLabel(orderNumber: string | null): string {
  return orderNumber ?? "(fără număr)";
}

interface TemplateContent {
  subject: string;
  intro: string;
}

const TEMPLATES: Record<NotifiableOrderStatus, (data: OrderEmailData) => TemplateContent> = {
  sent: (data) => ({
    subject: `Comanda ${orderLabel(data.orderNumber)} a fost trimisă`,
    intro:
      `Comanda dumneavoastră ${orderLabel(data.orderNumber)} a fost trimisă și așteaptă ` +
      `confirmarea ${data.organizationName}.`,
  }),
  accepted: (data) => ({
    subject: `Comanda ${orderLabel(data.orderNumber)} a fost acceptată`,
    intro:
      `Comanda dumneavoastră ${orderLabel(data.orderNumber)} a fost acceptată și este în curs ` +
      `de pregătire pentru livrare.`,
  }),
  delivered: (data) => ({
    subject: `Comanda ${orderLabel(data.orderNumber)} a fost livrată`,
    intro: `Comanda dumneavoastră ${orderLabel(data.orderNumber)} a fost livrată.`,
  }),
  closed: (data) => ({
    subject: `Comanda ${orderLabel(data.orderNumber)} a fost închisă — certificat disponibil`,
    intro:
      `Comanda dumneavoastră ${orderLabel(data.orderNumber)} a fost închisă. Certificatul de ` +
      `trasabilitate a fost generat și este disponibil în portalul clienților.`,
  }),
  cancelled: (data) => ({
    subject: `Comanda ${orderLabel(data.orderNumber)} a fost anulată`,
    intro: `Comanda dumneavoastră ${orderLabel(data.orderNumber)} a fost anulată.`,
  }),
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(orgName: string, clientName: string, intro: string): string {
  return [
    "<!doctype html>",
    '<html lang="ro">',
    '  <body style="font-family: sans-serif; color: #1f2937;">',
    `    <p>Bună ziua, ${escapeHtml(clientName)},</p>`,
    `    <p>${escapeHtml(intro)}</p>`,
    `    <p>Cu stimă,<br/>Echipa ${escapeHtml(orgName)}</p>`,
    "  </body>",
    "</html>",
  ].join("\n");
}

function renderText(orgName: string, clientName: string, intro: string): string {
  return `Bună ziua, ${clientName},\n\n${intro}\n\nCu stimă,\nEchipa ${orgName}\n`;
}

/**
 * Randare PURA (fara I/O, testabila direct) a emailului pt. o tranzitie de
 * status comanda. Arunca daca `toStatus` nu are template (doar `draft`, care nu
 * ar trebui sa ajunga niciodata aici — vezi `notificationTypeForOrderStatus`,
 * folosit de service.ts ca sa evite exact acest apel).
 */
export function renderOrderStatusEmail(data: OrderEmailData, toStatus: OrderStatus): RenderedEmail {
  if (!isNotifiableStatus(toStatus)) {
    throw new Error(`Statusul "${toStatus}" nu are un template de notificare (e intern).`);
  }

  const { subject, intro } = TEMPLATES[toStatus](data);
  return {
    subject,
    html: renderHtml(data.organizationName, data.clientName, intro),
    text: renderText(data.organizationName, data.clientName, intro),
  };
}
