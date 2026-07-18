import { createClient } from "@/lib/supabase/server";
import { exclusiveEndOfDay, startOfDayIso, type DateRange } from "./period";
import type {
  DeliveredOrderInput,
  OrderItemLine,
  OrderStatus,
  ProcessInputLineInput,
  RecycledLotInput,
  ReturnLinkInput,
} from "./types";

/**
 * Stratul de IO al rapoartelor (Task X3) — un fetch brut per sursa de date, fara logica
 * de business (agregari/formule in `calculations.ts`). RLS filtreaza automat pe
 * organizatia curenta — niciun filtru explicit de `organization_id` (acelasi pattern ca
 * `orders/queries.ts`, `stock/queries.ts`).
 */

const STATUSES_DELIVERED_OR_CLOSED: OrderStatus[] = ["delivered", "closed"];

/** Statusul comenzilor create in perioada (dupa `created_at`) — Raport 1. */
export async function fetchOrderStatusesCreatedInRange(
  range: DateRange,
): Promise<{ status: OrderStatus }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("status")
    .gte("created_at", startOfDayIso(range.from))
    .lt("created_at", exclusiveEndOfDay(range.to));
  if (error) throw new Error("Nu am putut încărca comenzile pentru raport.");
  return data ?? [];
}

/**
 * Liniile unui set de comenzi, grupate pe `order_id` — interogare separata (nu embed pe
 * 2 niveluri), in stilul `orders/queries.ts#summarizeOrderItems`.
 */
async function fetchOrderItemLinesByOrder(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orderIds: string[],
): Promise<Map<string, OrderItemLine[]>> {
  const byOrder = new Map<string, OrderItemLine[]>();
  if (orderIds.length === 0) return byOrder;

  const { data, error } = await supabase
    .from("order_items")
    .select("order_id, item_id, quantity, items(title, unit)")
    .in("order_id", orderIds);
  if (error) throw new Error("Nu am putut încărca liniile comenzilor pentru raport.");

  for (const row of data ?? []) {
    const lines = byOrder.get(row.order_id) ?? [];
    lines.push({
      itemId: row.item_id,
      itemTitle: row.items?.title ?? "—",
      unit: row.items?.unit ?? "kg",
      quantity: Number(row.quantity),
    });
    byOrder.set(row.order_id, lines);
  }
  return byOrder;
}

/**
 * Toate comenzile `delivered`/`closed` (fara filtru de perioada — data de referinta e
 * ambigua, `delivery_date ?? updated_at`, vezi `calculations.ts#resolveDeliveryReferenceDate`;
 * filtrarea pe perioada se face in JS, pur, dupa fetch) + liniile lor. Sursa comuna pt.
 * Raportul 2 (Livrari) si latura "livrat" a Raportului 5 (PaaS).
 */
export async function fetchDeliveredOrdersWithItems(): Promise<DeliveredOrderInput[]> {
  const supabase = await createClient();
  const { data: orderRows, error } = await supabase
    .from("orders")
    .select("id, order_number, status, client_id, delivery_date, updated_at, clients(name)")
    .in("status", STATUSES_DELIVERED_OR_CLOSED);
  if (error) throw new Error("Nu am putut încărca comenzile livrate pentru raport.");

  const orderIds = (orderRows ?? []).map((row) => row.id);
  const itemsByOrder = await fetchOrderItemLinesByOrder(supabase, orderIds);

  return (orderRows ?? []).map((row) => ({
    id: row.id,
    orderNumber: row.order_number,
    status: row.status,
    clientId: row.client_id,
    clientName: row.clients?.name ?? "—",
    deliveryDate: row.delivery_date,
    updatedAt: row.updated_at,
    items: itemsByOrder.get(row.id) ?? [],
  }));
}

/**
 * Toate legaturile `order_links` de tip `return`/`warranty` (fara `replacement` — nu e o
 * miscare de material), cu comanda originala (client) + comanda-retur (status/`updated_at`)
 * + liniile ei. Fara filtru de perioada la fetch (doua rapoarte folosesc doua date de
 * referinta diferite — cererea legaturii vs. acceptarea returului — filtrarea e pura,
 * in `calculations.ts`). Interogari secventiale + imbinare in JS, in stilul
 * `returns/queries.ts#getReturnableItems` (evita embed ambiguu: `order_links` are DOUA
 * chei straine catre `orders`).
 */
export async function fetchReturnLinks(): Promise<ReturnLinkInput[]> {
  const supabase = await createClient();

  const { data: linkRows, error: linksError } = await supabase
    .from("order_links")
    .select("id, link_type, created_at, original_order_id, linked_order_id")
    .in("link_type", ["return", "warranty"]);
  if (linksError) throw new Error("Nu am putut încărca legăturile de retur.");
  if (!linkRows || linkRows.length === 0) return [];

  const originalOrderIds = [...new Set(linkRows.map((row) => row.original_order_id))];
  const returnOrderIds = [...new Set(linkRows.map((row) => row.linked_order_id))];
  const allOrderIds = [...new Set([...originalOrderIds, ...returnOrderIds])];

  const { data: orderRows, error: ordersError } = await supabase
    .from("orders")
    .select("id, order_number, status, client_id, updated_at, clients(name)")
    .in("id", allOrderIds);
  if (ordersError) throw new Error("Nu am putut încărca comenzile legate de retur.");
  const orderById = new Map((orderRows ?? []).map((row) => [row.id, row]));

  const itemsByOrder = await fetchOrderItemLinesByOrder(supabase, returnOrderIds);

  const results: ReturnLinkInput[] = [];
  for (const link of linkRows) {
    const original = orderById.get(link.original_order_id);
    const returnOrder = orderById.get(link.linked_order_id);
    if (!original || !returnOrder) continue; // RLS a ascuns una dintre comenzi — defensiv
    results.push({
      linkId: link.id,
      linkType: link.link_type as "return" | "warranty",
      linkCreatedAt: link.created_at,
      originalOrderId: original.id,
      originalOrderNumber: original.order_number,
      clientId: original.client_id,
      clientName: original.clients?.name ?? "—",
      returnOrderId: returnOrder.id,
      returnOrderNumber: returnOrder.order_number,
      returnOrderStatus: returnOrder.status,
      returnOrderUpdatedAt: returnOrder.updated_at,
      items: itemsByOrder.get(link.linked_order_id) ?? [],
    });
  }
  return results;
}

/**
 * Loturi cu proveniența secundara (reciclare/recondiționare/retur), filtrate direct in
 * SQL pe `entry_date` (coloana `date`, comparabila cu perioada fara conversie de ora) —
 * Raportul 4 (Materiale reciclate/recondiționate reintegrate).
 */
export async function fetchRecycledLotsInRange(range: DateRange): Promise<RecycledLotInput[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lots")
    .select("provenance, item_id, initial_qty, items(title, unit)")
    .in("provenance", ["recycling", "reconditioning", "return"])
    .gte("entry_date", range.from)
    .lte("entry_date", range.to);
  if (error) throw new Error("Nu am putut încărca loturile pentru raport.");

  return (data ?? []).map((row) => ({
    provenance: row.provenance,
    itemId: row.item_id,
    itemTitle: row.items?.title ?? "—",
    unit: row.items?.unit ?? "kg",
    quantity: Number(row.initial_qty),
  }));
}

/**
 * Liniile de input de proces (cu proveniența lotului consumat) pentru procesele
 * finalizate in perioada, grupate implicit pe `output_item_id` (produsul fabricat) —
 * Raportul 6 (% materii prime secundare). Procesele fara `output_item_id` (nu ar trebui
 * sa existe la un proces `completed`, dar defensiv) sunt ignorate.
 */
export async function fetchProcessInputsCompletedInRange(
  range: DateRange,
): Promise<ProcessInputLineInput[]> {
  const supabase = await createClient();
  const { data: processRows, error: processesError } = await supabase
    .from("processes")
    .select("id, output_item_id, items(title)")
    .eq("status", "completed")
    .gte("completed_at", startOfDayIso(range.from))
    .lt("completed_at", exclusiveEndOfDay(range.to));
  if (processesError) throw new Error("Nu am putut încărca procesele pentru raport.");

  const processes = (processRows ?? []).filter(
    (row): row is typeof row & { output_item_id: string } => row.output_item_id !== null,
  );
  if (processes.length === 0) return [];

  const processIds = processes.map((row) => row.id);
  const { data: inputRows, error: inputsError } = await supabase
    .from("process_inputs")
    .select("process_id, quantity, lots(provenance)")
    .in("process_id", processIds);
  if (inputsError) throw new Error("Nu am putut încărca inputurile de proces pentru raport.");

  const processById = new Map(processes.map((row) => [row.id, row]));

  const results: ProcessInputLineInput[] = [];
  for (const input of inputRows ?? []) {
    const process = processById.get(input.process_id);
    if (!process || !input.lots) continue;
    results.push({
      productItemId: process.output_item_id,
      productTitle: process.items?.title ?? "—",
      provenance: input.lots.provenance,
      quantity: Number(input.quantity),
    });
  }
  return results;
}
