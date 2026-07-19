import {
  aggregateOrdersByStatus,
  aggregateRecycledMaterials,
  computePaasUsage,
  computeSecondaryMaterialShare,
  filterAcceptedReturnLinksInRange,
  filterDeliveredOrdersInRange,
  filterReturnLinksRequestedInRange,
  formatItemsSummary,
  resolveDeliveryReferenceDate,
} from "./calculations";
import type { DateRange } from "./period";
import {
  fetchDeliveredOrdersWithItems,
  fetchOrderStatusesCreatedInRange,
  fetchProcessInputsCompletedInRange,
  fetchRecycledLotsInRange,
  fetchReturnLinks,
} from "./repository";
import type {
  DeliveryReportRow,
  OrderStatusCount,
  PaasLineInput,
  PaasUsageRow,
  RecycledMaterialRow,
  ReturnReportRow,
  SecondaryMaterialRow,
} from "./types";

/**
 * API public al modulului de rapoarte — combina `repository.ts` (IO) cu
 * `calculations.ts` (logica pura), consumat direct de `rapoarte/page.tsx` si de rutele
 * de export (PDF/CSV). O functie per raport din §3 al planului.
 */

/** Raport 1 — Comenzi pe perioada, grupate pe status. */
export async function getOrdersByStatusReport(range: DateRange): Promise<OrderStatusCount[]> {
  const rows = await fetchOrderStatusesCreatedInRange(range);
  return aggregateOrdersByStatus(rows);
}

/** Raport 2 — Livrari (comenzi delivered/closed) in perioada. */
export async function getDeliveriesReport(range: DateRange): Promise<DeliveryReportRow[]> {
  const all = await fetchDeliveredOrdersWithItems();
  const inRange = filterDeliveredOrdersInRange(all, range);
  return inRange
    .map((order) => ({
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      clientName: order.clientName,
      referenceDate: resolveDeliveryReferenceDate(order),
      itemsSummary: formatItemsSummary(order.items),
    }))
    .sort((a, b) => a.referenceDate.localeCompare(b.referenceDate));
}

/** Raport 3 — Retururi (order_links type return/warranty) cerute in perioada. */
export async function getReturnsReport(range: DateRange): Promise<ReturnReportRow[]> {
  const links = await fetchReturnLinks();
  const inRange = filterReturnLinksRequestedInRange(links, range);
  return inRange
    .map((link) => ({
      linkId: link.linkId,
      linkType: link.linkType,
      linkCreatedAt: link.linkCreatedAt,
      originalOrderNumber: link.originalOrderNumber,
      clientName: link.clientName,
      returnOrderNumber: link.returnOrderNumber,
      returnOrderStatus: link.returnOrderStatus,
      itemsSummary: formatItemsSummary(link.items),
    }))
    .sort((a, b) => a.linkCreatedAt.localeCompare(b.linkCreatedAt));
}

/** Raport 4 — Materiale reciclate/recondiționate reintegrate in perioada. */
export async function getRecycledMaterialsReport(range: DateRange): Promise<RecycledMaterialRow[]> {
  const lots = await fetchRecycledLotsInRange(range);
  return aggregateRecycledMaterials(lots);
}

/** Raport 5 — PaaS "utilizat = livrat - returnat" per client/item/perioada. */
export async function getPaasUsageReport(range: DateRange): Promise<PaasUsageRow[]> {
  const [allDelivered, allReturnLinks] = await Promise.all([
    fetchDeliveredOrdersWithItems(),
    fetchReturnLinks(),
  ]);

  const deliveredInRange = filterDeliveredOrdersInRange(allDelivered, range);
  const deliveredLines: PaasLineInput[] = deliveredInRange.flatMap((order) =>
    order.items.map((item) => ({
      clientId: order.clientId,
      clientName: order.clientName,
      itemId: item.itemId,
      itemTitle: item.itemTitle,
      unit: item.unit,
      quantity: item.quantity,
    })),
  );

  const acceptedReturnsInRange = filterAcceptedReturnLinksInRange(allReturnLinks, range);
  const returnedLines: PaasLineInput[] = acceptedReturnsInRange.flatMap((link) =>
    link.items.map((item) => ({
      clientId: link.clientId,
      clientName: link.clientName,
      itemId: item.itemId,
      itemTitle: item.itemTitle,
      unit: item.unit,
      quantity: item.quantity,
    })),
  );

  return computePaasUsage(deliveredLines, returnedLines);
}

/** Raport 6 — % materii prime secundare per produs/perioada. */
export async function getSecondaryMaterialReport(
  range: DateRange,
): Promise<SecondaryMaterialRow[]> {
  const lines = await fetchProcessInputsCompletedInRange(range);
  return computeSecondaryMaterialShare(lines);
}
