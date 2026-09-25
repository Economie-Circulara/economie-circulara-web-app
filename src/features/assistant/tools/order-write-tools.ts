import { cancelDelivery } from "@/features/deliveries/service";
import { getDeliveryByOrderId } from "@/features/deliveries/queries";
import { ORDER_STATUS_LABELS, ORDER_TYPE_LABELS } from "@/features/orders/labels";
import { onOrderStatusChanged } from "@/features/orders/notifications";
import { getOrderDetail, getOrderStatus } from "@/features/orders/queries";
import {
  acceptIntakeOrder,
  acceptOrder,
  cancelOrder,
  deleteDraftOrder,
} from "@/features/orders/service";
import { assertOrderTransition } from "@/features/orders/state-machine";
import type { OrderDetail } from "@/features/orders/types";
import { resultField } from "../result-summary";
import type { ToolContext } from "../types";
import { infoField, textField } from "./fields";
import type { CardPresentation } from "./presentation-types";
import { asObject, InvalidToolArgumentsError, requiredString, type AssistantTool } from "./types";

/**
 * Tool-uri de scriere pe comenzi existente (acceptare, anulare, stergere ciorna,
 * anularea livrarii). Apeleaza aceleasi servicii ca butoanele din `/comenzi/[id]`
 * (`orders/actions.ts`), inclusiv masina de stari si notificarile - diferenta e doar
 * ca propunerea trece prin cardul de confirmare.
 */

type OrderIdInput = { order_id: string };

const orderIdParameters = {
  type: "object",
  additionalProperties: false,
  properties: { order_id: { type: "string", description: "ID-ul comenzii." } },
  required: ["order_id"],
} as const;

const parseOrderId = (args: unknown): OrderIdInput => ({
  order_id: requiredString(asObject(args), "order_id"),
});

function orderLabel(order: OrderDetail | null): string {
  return order
    ? `${order.orderNumber ?? "Comandă fără număr"} · ${order.clientName}`
    : "Comandă indisponibilă";
}

/** „ **CMD-1**” din rezultat, sau nimic. */
function numberOf(result: unknown): string {
  const number = resultField(result, "numar");
  return number ? ` **${number}**` : "";
}

function linesSummary(order: OrderDetail | null): string {
  if (!order || order.items.length === 0) return "-";
  return order.items.map((line) => `${line.itemTitle} × ${line.quantity} ${line.unit}`).join(", ");
}

async function requireOrder(orderId: string): Promise<OrderDetail> {
  const order = await getOrderDetail(orderId);
  if (!order) throw new InvalidToolArgumentsError("Comanda nu există sau nu este accesibilă.");
  return order;
}

function requireOrg(ctx: ToolContext): string {
  if (!ctx.organizationId) {
    throw new InvalidToolArgumentsError("Utilizatorul curent nu are o organizație asociată.");
  }
  return ctx.organizationId;
}

export const acceptaComanda: AssistantTool<OrderIdInput> = {
  name: "accepta_comanda",
  description:
    "Propune ACCEPTAREA unei comenzi. `material`/`serviciu` (status Înaintată): scade stocul " +
    "FIFO pentru fiecare linie, atomic - la stoc insuficient nu se schimbă nimic. `aport` " +
    "(status Ciornă sau Trimisă): materialul adus de client intră în stoc ca loturi noi. " +
    "Acțiunea NU se execută până la confirmare.",
  parameters: orderIdParameters,
  roles: ["admin", "operator"],
  version: 1,
  kind: "write",
  parse: parseOrderId,
  summary: () => "Acceptă comanda",
  resultSummary: (_input, result) =>
    `Am acceptat comanda${numberOf(result)}. Stocul a fost actualizat.`,
  presentation: async (input): Promise<CardPresentation> => {
    const order = await getOrderDetail(input.order_id);
    const effect =
      order?.orderType === "aport"
        ? "Materialul intră în stoc ca loturi noi (provenință aport client, calitate neverificată)."
        : "Stocul scade acum, FIFO, pentru fiecare linie. La stoc insuficient nu se schimbă nimic.";
    return {
      renderer: "generic",
      fields: [
        infoField("order_id", "Comandă", orderLabel(order)),
        infoField("tip", "Tip", order ? ORDER_TYPE_LABELS[order.orderType] : "-"),
        infoField("linii", "Linii", linesSummary(order)),
        infoField("efect", "Ce se întâmplă", effect),
      ],
    };
  },
  execute: async (input, ctx) => {
    const organizationId = requireOrg(ctx);
    const order = await requireOrder(input.order_id);

    // Comanda-aport nu parcurge masina de stari de vanzare; emailul catre client are
    // formularea de aport - identic cu `acceptIntakeAction` (migrarile 0031/0042).
    if (order.orderType === "aport") {
      const accepted = await acceptIntakeOrder(order.id);
      await onOrderStatusChanged({
        orderId: accepted.id,
        organizationId,
        clientId: accepted.clientId,
        fromStatus: order.status,
        toStatus: "accepted",
        kind: "intake",
      });
      return {
        order_id: accepted.id,
        numar: order.orderNumber,
        status: accepted.status,
        link: `/comenzi/${accepted.id}`,
      };
    }

    const fromStatus = order.status;
    assertOrderTransition(fromStatus, "accepted");
    const accepted = await acceptOrder(order.id);
    await onOrderStatusChanged({
      orderId: accepted.id,
      organizationId,
      clientId: accepted.clientId,
      fromStatus,
      toStatus: "accepted",
    });
    return {
      order_id: accepted.id,
      numar: order.orderNumber,
      status: accepted.status,
      link: `/comenzi/${accepted.id}`,
    };
  },
};

export const anuleazaComanda: AssistantTool<OrderIdInput> = {
  name: "anuleaza_comanda",
  description:
    "Propune ANULAREA unei comenzi (Ciornă, Înaintată sau Acceptată). La o comandă acceptată " +
    "stocul consumat se reface. Comenzile livrate/închise nu se pot anula. O ciornă se poate " +
    "și șterge (`sterge_ciorna`). Acțiunea NU se execută până la confirmare.",
  parameters: orderIdParameters,
  roles: ["admin", "operator"],
  version: 1,
  kind: "write",
  parse: parseOrderId,
  summary: () => "Anulează comanda",
  resultSummary: (_input, result) =>
    `Am anulat comanda${numberOf(result)}. Dacă fusese acceptată, stocul s-a refăcut.`,
  presentation: async (input): Promise<CardPresentation> => {
    const order = await getOrderDetail(input.order_id);
    const effect =
      order?.status === "accepted"
        ? "Comanda devine Anulată, iar stocul consumat la acceptare se reface."
        : "Comanda devine Anulată. Stocul nu se modifică.";
    return {
      renderer: "generic",
      fields: [
        infoField("order_id", "Comandă", orderLabel(order)),
        infoField("status", "Status actual", order ? ORDER_STATUS_LABELS[order.status] : "-"),
        infoField("efect", "Ce se întâmplă", effect),
      ],
    };
  },
  execute: async (input, ctx) => {
    const organizationId = requireOrg(ctx);
    const fromStatus = await getOrderStatus(input.order_id);
    if (!fromStatus)
      throw new InvalidToolArgumentsError("Comanda nu există sau nu este accesibilă.");
    assertOrderTransition(fromStatus, "cancelled");

    const cancelled = await cancelOrder(input.order_id);
    await onOrderStatusChanged({
      orderId: cancelled.id,
      organizationId,
      clientId: cancelled.clientId,
      fromStatus,
      toStatus: "cancelled",
    });
    return {
      order_id: cancelled.id,
      numar: cancelled.orderNumber,
      status: cancelled.status,
      link: `/comenzi/${cancelled.id}`,
    };
  },
};

export const stergeCiorna: AssistantTool<OrderIdInput> = {
  name: "sterge_ciorna",
  description:
    "Propune ȘTERGEREA unei comenzi aflate în Ciornă (ștergere logică - dispare din liste). " +
    "Doar ciornele se pot șterge; restul se anulează (`anuleaza_comanda`). " +
    "Acțiunea NU se execută până la confirmare.",
  parameters: orderIdParameters,
  roles: ["admin", "operator"],
  version: 1,
  kind: "write",
  parse: parseOrderId,
  summary: () => "Șterge ciorna",
  resultSummary: () => "Am șters ciorna. Nu mai apare în lista de comenzi.",
  presentation: async (input): Promise<CardPresentation> => {
    const order = await getOrderDetail(input.order_id);
    return {
      renderer: "generic",
      fields: [
        infoField("order_id", "Comandă", orderLabel(order)),
        infoField("linii", "Linii", linesSummary(order)),
        infoField("efect", "Ce se întâmplă", "Ciorna dispare din listă. Stocul nu se modifică."),
      ],
    };
  },
  execute: async (input) => {
    await deleteDraftOrder(input.order_id);
    return { order_id: input.order_id, sters: true };
  },
};

type CancelDeliveryInput = { order_id: string; motiv: string };

export const anuleazaLivrare: AssistantTool<CancelDeliveryInput> = {
  name: "anuleaza_livrare",
  description:
    "Propune ANULAREA livrării planificate a unei comenzi - posibilă doar înainte de plecare " +
    "(nedeclarată la e-Transport, fără recepție). Comanda rămâne Acceptată și se poate " +
    "replanifica. Motivul e obligatoriu - cere-l utilizatorului. " +
    "Acțiunea NU se execută până la confirmare.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      order_id: { type: "string", description: "ID-ul comenzii a cărei livrare se anulează." },
      motiv: { type: "string", description: "Motivul anulării." },
    },
    required: ["order_id", "motiv"],
  },
  roles: ["admin", "operator"],
  version: 1,
  kind: "write",
  parse: (args) => {
    const raw = asObject(args);
    return { order_id: requiredString(raw, "order_id"), motiv: requiredString(raw, "motiv") };
  },
  summary: () => "Anulează livrarea",
  resultSummary: () => "Am anulat livrarea. Comanda rămâne acceptată și poate fi replanificată.",
  presentation: async (input): Promise<CardPresentation> => {
    const [order, delivery] = await Promise.all([
      getOrderDetail(input.order_id),
      getDeliveryByOrderId(input.order_id),
    ]);
    return {
      renderer: "generic",
      fields: [
        infoField("order_id", "Comandă", orderLabel(order)),
        infoField(
          "livrare",
          "Livrare",
          delivery
            ? `${delivery.scheduledDate} · ${delivery.carrierName} · ${delivery.vehiclePlate}`
            : "Comanda nu are o livrare planificată",
        ),
        textField("motiv", "Motivul anulării", input.motiv),
      ],
    };
  },
  execute: async (input) => {
    const delivery = await getDeliveryByOrderId(input.order_id);
    if (!delivery) {
      throw new InvalidToolArgumentsError("Comanda nu are o livrare planificată.");
    }
    await cancelDelivery(delivery.id, input.motiv);
    return {
      order_id: input.order_id,
      livrare_id: delivery.id,
      anulata: true,
      link: `/comenzi/${input.order_id}`,
    };
  },
};

export const ORDER_WRITE_TOOLS = [acceptaComanda, anuleazaComanda, stergeCiorna, anuleazaLivrare];
