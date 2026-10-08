import type { OrderStatus } from "@/features/orders/types";
import { emailBrandFor, type EmailBrand } from "./email-brand";
import { renderEmailLayout } from "./layout";
import type { NotificationType } from "./types";

/**
 * Ce fel de comanda e, din punctul de vedere al clientului: o comanda de vanzare
 * (implicit), o cerere de aport (materialul vine DE LA client) sau o cerere de
 * retur/garantie. Schimba formularea emailului - "acceptată" la un aport nu
 * inseamna "în curs de pregătire pentru livrare".
 */
export type OrderEmailKind = "order" | "intake" | "return";

/** Datele minime necesare randarii unui email de status comanda (RO). */
export interface OrderEmailData {
  orderNumber: string | null;
  clientName: string;
  organizationName: string;
  kind?: OrderEmailKind;
  /** Brandul organizatiei (logo, culoare, subsol); lipsa -> brandul platformei cu `organizationName`. */
  brand?: EmailBrand;
  /** Linkul catre comanda in portalul clientului (buton); lipsa -> fara buton. */
  portalUrl?: string | null;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/**
 * Statusurile care declanseaza o notificare (toate in afara de `draft`, care e
 * intern - nicio actiune din src/features/orders/actions.ts nu emite
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

/** Substantivul (subiect / cu posesiv) pentru fiecare fel de comanda - toate feminine. */
const KIND_NOUNS: Record<OrderEmailKind, { subject: string; yours: string }> = {
  order: { subject: "Comanda", yours: "Comanda dumneavoastră" },
  intake: { subject: "Cererea de aport", yours: "Cererea dumneavoastră de aport" },
  return: { subject: "Cererea de retur", yours: "Cererea dumneavoastră de retur" },
};

const ACCEPTED_DETAIL: Record<OrderEmailKind, (orgName: string) => string> = {
  order: () => "a fost acceptată și este în curs de pregătire pentru livrare.",
  intake: (orgName) => `a fost acceptată: materialul a fost recepționat de ${orgName}.`,
  return: (orgName) => `a fost acceptată: produsele au fost recepționate de ${orgName}.`,
};

const TEMPLATES: Record<NotifiableOrderStatus, (data: OrderEmailData) => TemplateContent> = {
  sent: (data) => {
    const noun = KIND_NOUNS[data.kind ?? "order"];
    return {
      subject: `${noun.subject} ${orderLabel(data.orderNumber)} a fost trimisă`,
      intro:
        `${noun.yours} ${orderLabel(data.orderNumber)} a fost trimisă și așteaptă ` +
        `confirmarea ${data.organizationName}.`,
    };
  },
  accepted: (data) => {
    const kind = data.kind ?? "order";
    const noun = KIND_NOUNS[kind];
    return {
      subject: `${noun.subject} ${orderLabel(data.orderNumber)} a fost acceptată`,
      intro: `${noun.yours} ${orderLabel(data.orderNumber)} ${ACCEPTED_DETAIL[kind](data.organizationName)}`,
    };
  },
  delivered: (data) => ({
    subject: `Comanda ${orderLabel(data.orderNumber)} a fost livrată`,
    intro: `Comanda dumneavoastră ${orderLabel(data.orderNumber)} a fost livrată.`,
  }),
  closed: (data) => ({
    subject: `Comanda ${orderLabel(data.orderNumber)} a fost închisă - fișa de trasabilitate e disponibilă`,
    intro:
      `Comanda dumneavoastră ${orderLabel(data.orderNumber)} a fost închisă. Fișa de ` +
      `trasabilitate a fost generat și este disponibil în portalul clienților.`,
  }),
  cancelled: (data) => {
    const noun = KIND_NOUNS[data.kind ?? "order"];
    return {
      subject: `${noun.subject} ${orderLabel(data.orderNumber)} a fost anulată`,
      intro: `${noun.yours} ${orderLabel(data.orderNumber)} a fost anulată.`,
    };
  },
};

/**
 * Randare PURA (fara I/O, testabila direct) a emailului pt. o tranzitie de
 * status comanda. Arunca daca `toStatus` nu are template (doar `draft`, care nu
 * ar trebui sa ajunga niciodata aici - vezi `notificationTypeForOrderStatus`,
 * folosit de service.ts ca sa evite exact acest apel).
 */
export function renderOrderStatusEmail(data: OrderEmailData, toStatus: OrderStatus): RenderedEmail {
  if (!isNotifiableStatus(toStatus)) {
    throw new Error(`Statusul "${toStatus}" nu are un template de notificare (e intern).`);
  }

  const { subject, intro } = TEMPLATES[toStatus](data);
  const brand = data.brand ?? {
    ...emailBrandFor(null),
    organizationName: data.organizationName,
  };
  const layout = renderEmailLayout(brand, {
    preheader: intro,
    paragraphs: [
      `Bună ziua, ${data.clientName},`,
      intro,
      `Cu stimă,\nEchipa ${data.organizationName}`,
    ],
    action: data.portalUrl ? { label: "Deschide în portal", url: data.portalUrl } : undefined,
  });
  return { subject, ...layout };
}
