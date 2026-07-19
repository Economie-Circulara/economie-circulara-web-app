import type { Database } from "@/lib/database.types";

export type OrderStatus = Database["public"]["Enums"]["order_status"];
export type OrderLinkType = Database["public"]["Enums"]["order_link_type"];
export type LotProvenance = Database["public"]["Enums"]["lot_provenance"];

// -----------------------------------------------------------------------------
// KPI dashboard (`dashboard-queries.ts`)
// -----------------------------------------------------------------------------

/** Cardurile KPI din mockup — vezi formulele in docs/plans/task-x3-rapoarte.md §2. */
export interface DashboardKpis {
  activeOrders: number;
  ordersToAccept: number;
  deliveredThisMonth: number;
  certificatesIssued: number;
}

// -----------------------------------------------------------------------------
// Raport 1 — Comenzi pe perioada
// -----------------------------------------------------------------------------

export interface OrderStatusCount {
  status: OrderStatus;
  label: string;
  count: number;
}

// -----------------------------------------------------------------------------
// Date brute comune (repository.ts) — linie de item generica (comanda/retur).
// -----------------------------------------------------------------------------

export interface OrderItemLine {
  itemId: string;
  itemTitle: string;
  unit: string;
  quantity: number;
}

/** O comanda `delivered`/`closed`, cu liniile ei — sursa pt. rapoartele 2 si 5. */
export interface DeliveredOrderInput {
  id: string;
  orderNumber: string | null;
  status: OrderStatus;
  clientId: string;
  clientName: string;
  /** Data planificata de livrare (optionala, introdusa la creare) — vezi limitarea din plan. */
  deliveryDate: string | null;
  updatedAt: string;
  items: OrderItemLine[];
}

// -----------------------------------------------------------------------------
// Raport 2 — Livrari
// -----------------------------------------------------------------------------

export interface DeliveryReportRow {
  orderId: string;
  orderNumber: string | null;
  status: OrderStatus;
  clientName: string;
  /** Data folosita pt. filtrarea pe perioada — `resolveDeliveryReferenceDate`. */
  referenceDate: string;
  itemsSummary: string;
}

// -----------------------------------------------------------------------------
// Raport 3 — Retururi (order_links type return/warranty)
// -----------------------------------------------------------------------------

/** Un `order_links` (return/warranty) + comanda originala/retur + liniile returnate. */
export interface ReturnLinkInput {
  linkId: string;
  linkType: Extract<OrderLinkType, "return" | "warranty">;
  linkCreatedAt: string;
  originalOrderId: string;
  originalOrderNumber: string | null;
  clientId: string;
  clientName: string;
  returnOrderId: string;
  returnOrderNumber: string | null;
  returnOrderStatus: OrderStatus;
  returnOrderUpdatedAt: string;
  items: OrderItemLine[];
}

export interface ReturnReportRow {
  linkId: string;
  linkType: Extract<OrderLinkType, "return" | "warranty">;
  linkCreatedAt: string;
  originalOrderNumber: string | null;
  clientName: string;
  returnOrderNumber: string | null;
  returnOrderStatus: OrderStatus;
  itemsSummary: string;
}

// -----------------------------------------------------------------------------
// Raport 4 — Materiale reciclate/recondiționate reintegrate
// -----------------------------------------------------------------------------

export interface RecycledLotInput {
  provenance: LotProvenance;
  itemId: string;
  itemTitle: string;
  unit: string;
  quantity: number;
}

export interface RecycledMaterialRow {
  provenance: LotProvenance;
  provenanceLabel: string;
  itemId: string;
  itemTitle: string;
  unit: string;
  quantity: number;
  lotsCount: number;
}

// -----------------------------------------------------------------------------
// Raport 5 — PaaS "utilizat = livrat - returnat" per client/perioada
// -----------------------------------------------------------------------------

export interface PaasLineInput {
  clientId: string;
  clientName: string;
  itemId: string;
  itemTitle: string;
  unit: string;
  quantity: number;
}

export interface PaasUsageRow {
  clientId: string;
  clientName: string;
  itemId: string;
  itemTitle: string;
  unit: string;
  delivered: number;
  returned: number;
  used: number;
}

// -----------------------------------------------------------------------------
// Raport 6 — % materii prime secundare per produs/perioada
// -----------------------------------------------------------------------------

export interface ProcessInputLineInput {
  productItemId: string;
  productTitle: string;
  provenance: LotProvenance;
  quantity: number;
}

export interface SecondaryMaterialRow {
  productItemId: string;
  productTitle: string;
  totalInput: number;
  secondaryInput: number;
  /** 0-100, rotunjit la o zecimala. */
  percentageSecondary: number;
}
