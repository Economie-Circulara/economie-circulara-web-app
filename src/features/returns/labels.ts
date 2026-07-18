import type { OrderLinkType } from "./types";

/** Etichete RO pentru tipul unei legaturi intre comenzi (order_links.link_type). */
export const ORDER_LINK_TYPE_LABELS: Record<OrderLinkType, string> = {
  return: "Retur",
  warranty: "Garanție",
  replacement: "Înlocuire (garanție)",
};
