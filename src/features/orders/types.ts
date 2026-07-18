import type { Database } from "@/lib/database.types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type UnitOfMeasure = Database["public"]["Enums"]["unit_of_measure"];

/** O comanda, asa cum e afisata/editata in ecranele /comenzi. */
export interface Order {
  id: string;
  clientId: string;
  orderNumber: string | null;
  status: OrderStatus;
  createdByAdmin: boolean;
  deliveryAddressId: string | null;
  deliveryDate: string | null;
  expectedReturnDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Rand din lista /comenzi — comanda + rezumatul clientului si al produselor. */
export interface OrderListRow extends Order {
  clientName: string;
  /** Rezumat text al liniilor, ex. "Cărămidă eco ×4.000, Pavaj ×600". */
  itemsSummary: string;
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

/** Comanda + date client/livrare + linii — ecranul /comenzi/[id]. */
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
