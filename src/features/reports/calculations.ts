import { ORDER_STATUS_LABELS, ORDER_STATUS_OPTIONS } from "@/features/orders/labels";
import { PROVENANCE_LABELS } from "@/features/stock/labels";
import { isDateWithinRange, type DateRange } from "./period";
import type {
  DeliveredOrderInput,
  OrderStatusCount,
  PaasLineInput,
  PaasUsageRow,
  ProcessInputLineInput,
  RecycledLotInput,
  RecycledMaterialRow,
  ReturnLinkInput,
  SecondaryMaterialRow,
} from "./types";

/**
 * Logica de business a rapoartelor (Task X3) — functii PURE, fara Supabase, testate
 * direct cu date mock (`calculations.test.ts`). IO-ul (fetch din DB) traieste in
 * `repository.ts`; `queries.ts` combina cele doua straturi, in stilul
 * `certificates/traceability.ts` (pur) + `certificates/repository.ts` (IO).
 */

const SECONDARY_PROVENANCES: ReadonlySet<string> = new Set([
  "recycling",
  "reconditioning",
  "return",
]);

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// -----------------------------------------------------------------------------
// Raport 1 — Comenzi pe perioada, grupate pe status
// -----------------------------------------------------------------------------

/** Agrega comenzile (deja filtrate pe perioada dupa `created_at`) pe status. */
export function aggregateOrdersByStatus(orders: { status: string }[]): OrderStatusCount[] {
  const counts = new Map<string, number>();
  for (const order of orders) {
    counts.set(order.status, (counts.get(order.status) ?? 0) + 1);
  }
  return ORDER_STATUS_OPTIONS.map((status) => ({
    status,
    label: ORDER_STATUS_LABELS[status],
    count: counts.get(status) ?? 0,
  }));
}

// -----------------------------------------------------------------------------
// Raport 2 — Livrari (+ latura "livrat" a raportului PaaS)
// -----------------------------------------------------------------------------

/**
 * Data de referinta pentru "livrat in perioada": `delivery_date` (planificata, introdusa
 * manual la creare) daca exista, altfel `updated_at` (ultima tranzitie de status) —
 * schema `orders` nu are un timestamp dedicat "livrat la" (fara istoric de status),
 * aproximare documentata (docs/plans/task-x3-rapoarte.md §2).
 */
export function resolveDeliveryReferenceDate(
  order: Pick<DeliveredOrderInput, "deliveryDate" | "updatedAt">,
): string {
  return order.deliveryDate ?? order.updatedAt;
}

/** Comenzile livrate/inchise (deja fetch-uite, fara filtru de data) care cad in perioada. */
export function filterDeliveredOrdersInRange(
  orders: DeliveredOrderInput[],
  range: DateRange,
): DeliveredOrderInput[] {
  return orders.filter((order) => isDateWithinRange(resolveDeliveryReferenceDate(order), range));
}

/** Rezumat text al liniilor unei comenzi, ex. "Cărămidă eco ×4.000, Pavaj ×600". */
export function formatItemsSummary(items: { itemTitle: string; quantity: number }[]): string {
  if (items.length === 0) return "—";
  const qtyFormatter = new Intl.NumberFormat("ro-RO");
  return items.map((item) => `${item.itemTitle} ×${qtyFormatter.format(item.quantity)}`).join(", ");
}

// -----------------------------------------------------------------------------
// Raport 3 — Retururi (order_links type return/warranty)
// -----------------------------------------------------------------------------

/** Legaturile de retur/garantie a caror cerere (`created_at`) cade in perioada. */
export function filterReturnLinksRequestedInRange(
  links: ReturnLinkInput[],
  range: DateRange,
): ReturnLinkInput[] {
  return links.filter((link) => isDateWithinRange(link.linkCreatedAt, range));
}

/**
 * Legaturile de retur/garantie ACCEPTATE (material fizic reintrat in stoc) a caror
 * acceptare cade in perioada. Comanda-retur are o singura tranzitie posibila din
 * "draft" (RPC `accept_return_order`, 0010_returns.sql) — `updated_at` e deci un proxy
 * fiabil pentru "acceptat la" (nu se mai schimba ulterior).
 */
export function filterAcceptedReturnLinksInRange(
  links: ReturnLinkInput[],
  range: DateRange,
): ReturnLinkInput[] {
  return links.filter(
    (link) =>
      link.returnOrderStatus === "accepted" && isDateWithinRange(link.returnOrderUpdatedAt, range),
  );
}

// -----------------------------------------------------------------------------
// Raport 4 — Materiale reciclate/recondiționate reintegrate
// -----------------------------------------------------------------------------

/** Agrega loturile (deja filtrate pe perioada dupa `entry_date`) pe provenienta + item. */
export function aggregateRecycledMaterials(lots: RecycledLotInput[]): RecycledMaterialRow[] {
  const byKey = new Map<string, RecycledMaterialRow>();
  for (const lot of lots) {
    const key = `${lot.provenance}|${lot.itemId}`;
    const row = byKey.get(key) ?? {
      provenance: lot.provenance,
      provenanceLabel: PROVENANCE_LABELS[lot.provenance],
      itemId: lot.itemId,
      itemTitle: lot.itemTitle,
      unit: lot.unit,
      quantity: 0,
      lotsCount: 0,
    };
    row.quantity = round(row.quantity + lot.quantity);
    row.lotsCount += 1;
    byKey.set(key, row);
  }
  return [...byKey.values()].sort(
    (a, b) =>
      a.provenanceLabel.localeCompare(b.provenanceLabel) || a.itemTitle.localeCompare(b.itemTitle),
  );
}

// -----------------------------------------------------------------------------
// Raport 5 — PaaS "utilizat = livrat - returnat" per client/item/perioada
// -----------------------------------------------------------------------------

function paasKey(line: PaasLineInput): string {
  return `${line.clientId}|${line.itemId}`;
}

function emptyPaasRow(line: PaasLineInput): PaasUsageRow {
  return {
    clientId: line.clientId,
    clientName: line.clientName,
    itemId: line.itemId,
    itemTitle: line.itemTitle,
    unit: line.unit,
    delivered: 0,
    returned: 0,
    used: 0,
  };
}

/**
 * `utilizat = livrat - returnat`, per (client, item) — cerinta pietei PaaS (vezi
 * docs/analiza-cerere-finantare-client-paas.md, §3). `used` e clamped la 0 (un retur
 * dintr-o perioada urmatoare celei de livrare ar putea, teoretic, depasi livratul —
 * nu raportam cantitate negativa "utilizata").
 */
export function computePaasUsage(
  delivered: PaasLineInput[],
  returned: PaasLineInput[],
): PaasUsageRow[] {
  const byKey = new Map<string, PaasUsageRow>();

  for (const line of delivered) {
    const key = paasKey(line);
    const row = byKey.get(key) ?? emptyPaasRow(line);
    row.delivered = round(row.delivered + line.quantity);
    byKey.set(key, row);
  }
  for (const line of returned) {
    const key = paasKey(line);
    const row = byKey.get(key) ?? emptyPaasRow(line);
    row.returned = round(row.returned + line.quantity);
    byKey.set(key, row);
  }
  for (const row of byKey.values()) {
    row.used = round(Math.max(0, row.delivered - row.returned));
  }

  return [...byKey.values()].sort(
    (a, b) => a.clientName.localeCompare(b.clientName) || a.itemTitle.localeCompare(b.itemTitle),
  );
}

// -----------------------------------------------------------------------------
// Raport 6 — % materii prime secundare per produs/perioada
// -----------------------------------------------------------------------------

/**
 * % din inputul de proces provenit din surse secundare (reciclare/recondiționare/retur)
 * vs. total input, per produs fabricat (`processes.output_item_id`) — cerinta pietei PaaS
 * (tinta ≥60%, vezi docs/analiza-cerere-finantare-client-paas.md).
 */
export function computeSecondaryMaterialShare(
  lines: ProcessInputLineInput[],
): SecondaryMaterialRow[] {
  const byProduct = new Map<string, SecondaryMaterialRow>();
  for (const line of lines) {
    const row = byProduct.get(line.productItemId) ?? {
      productItemId: line.productItemId,
      productTitle: line.productTitle,
      totalInput: 0,
      secondaryInput: 0,
      percentageSecondary: 0,
    };
    row.totalInput += line.quantity;
    if (SECONDARY_PROVENANCES.has(line.provenance)) row.secondaryInput += line.quantity;
    byProduct.set(line.productItemId, row);
  }

  for (const row of byProduct.values()) {
    row.totalInput = round(row.totalInput);
    row.secondaryInput = round(row.secondaryInput);
    row.percentageSecondary =
      row.totalInput > 0 ? round((row.secondaryInput / row.totalInput) * 100, 1) : 0;
  }

  return [...byProduct.values()].sort((a, b) => b.percentageSecondary - a.percentageSecondary);
}
