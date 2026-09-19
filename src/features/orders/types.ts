import type { Database } from "@/lib/database.types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type OrderLinkType = Database["public"]["Enums"]["order_link_type"];
export type UnitOfMeasure = Database["public"]["Enums"]["unit_of_measure"];

/**
 * Tipul comenzii (migrarea 0030_order_types.sql) - determina SENSUL miscarii de
 * stoc si ce actiuni sunt oferite:
 *   material - vanzare clasica org -> client (scade stocul la acceptare)
 *   serviciu - inchiriere / PaaS (singurul tip cu `expectedReturnDate`)
 *   aport    - client -> org: material adus de client (creste stocul la acceptare)
 */
export type OrderType = Database["public"]["Enums"]["order_type"];

/** O comanda, asa cum e afisata/editata in ecranele /comenzi. */
export interface Order {
  id: string;
  clientId: string;
  orderNumber: string | null;
  orderType: OrderType;
  status: OrderStatus;
  createdByAdmin: boolean;
  deliveryAddressId: string | null;
  deliveryDate: string | null;
  expectedReturnDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Rand din lista /comenzi - comanda + rezumatul clientului si al produselor. */
export interface OrderListRow extends Order {
  clientName: string;
  /** Rezumat text al liniilor, ex. "Cărămidă eco ×4.000, Pavaj ×600". */
  itemsSummary: string;
  /**
   * Tipul legaturii `order_links` daca aceasta comanda e ea insăși un retur/
   * garanție/inlocuire (vezi `getReturnLinkForOrder`), altfel `null` (comanda de
   * vanzare obisnuita). Folosit pentru indicatorul de sens al stocului in listă:
   * "return"/"warranty" cresc stocul (intake), orice alta valoare (incl.
   * "replacement", care e o vanzare obisnuita) sau `null` il scade (consumption).
   */
  linkType: OrderLinkType | null;
}

/** Linia unei comenzi (item + cantitate), cu titlul/UM itemului. */
export interface OrderItemRow {
  id: string;
  orderId: string;
  itemId: string;
  itemTitle: string;
  unit: UnitOfMeasure;
  quantity: number;
}

/** Comanda + date client/livrare + linii - ecranul /comenzi/[id]. */
export interface OrderDetail extends Order {
  clientName: string;
  clientCui: string;
  deliveryAddressLabel: string | null;
  deliveryAddress: string | null;
  items: OrderItemRow[];
}

/** Linie de comanda in formularul de creare (inainte de a fi salvata). */
export interface OrderLineInput {
  itemId: string;
  quantity: number;
}
