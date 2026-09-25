import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { RouteChoiceView } from "@/features/routing/route-actions";
import type { DeliveryDetail, DeliveryItemLine, DeliveryListRow, DeliveryRecord } from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/** Subsetul de coloane `deliveries` folosit de `mapDelivery` (fara `organization_id`/`created_by`). */
type DeliveryCoreRow = Pick<
  Database["public"]["Tables"]["deliveries"]["Row"],
  | "id"
  | "organization_id"
  | "order_id"
  | "scheduled_date"
  | "carrier_name"
  | "vehicle_plate"
  | "driver_name"
  | "route_origin"
  | "route_destination"
  | "uit_code"
  | "declaration_status"
  | "declaration_error"
  | "origin_site_id"
  | "route_distance_m"
  | "route_duration_s"
  | "route_polyline"
  | "route_alternatives"
  | "route_selected_index"
  | "route_selection"
  | "route_computed_at"
  | "received_at"
  | "received_by_name"
  | "receipt_notes"
  | "received_via_portal"
  | "created_at"
  | "updated_at"
>;

/** Exportat - reutilizat de `service.ts` dupa insert/update (aceleasi coloane selectate). */
export function mapDelivery(row: DeliveryCoreRow): DeliveryRecord {
  return {
    id: row.id,
    organizationId: row.organization_id,
    orderId: row.order_id,
    scheduledDate: row.scheduled_date,
    carrierName: row.carrier_name,
    vehiclePlate: row.vehicle_plate,
    driverName: row.driver_name,
    routeOrigin: row.route_origin,
    routeDestination: row.route_destination,
    uitCode: row.uit_code,
    declarationStatus: row.declaration_status,
    declarationError: row.declaration_error,
    route: {
      originSiteId: row.origin_site_id,
      distanceMeters: row.route_distance_m,
      durationSeconds: row.route_duration_s,
      polyline: row.route_polyline,
      alternatives: (row.route_alternatives as RouteChoiceView[] | null) ?? null,
      selectedIndex: row.route_selected_index,
      selection: row.route_selection,
      computedAt: row.route_computed_at,
    },
    receipt: {
      receivedAt: row.received_at,
      receivedByName: row.received_by_name,
      receiptNotes: row.receipt_notes,
      receivedViaPortal: row.received_via_portal,
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Un singur literal de sir (NU concatenare cu `+`): concatenarea ar largi tipul la
// `string` simplu, iar clientul Supabase tipat are nevoie de LITERALUL exact ca sa
// infereze corect coloanele din `.select(...)` (altfel `GenericStringError`).
// prettier-ignore
export const DELIVERY_CORE_COLUMNS = "id, organization_id, order_id, scheduled_date, carrier_name, vehicle_plate, driver_name, route_origin, route_destination, uit_code, declaration_status, declaration_error, origin_site_id, route_distance_m, route_duration_s, route_polyline, route_alternatives, route_selected_index, route_selection, route_computed_at, received_at, received_by_name, receipt_notes, received_via_portal, created_at, updated_at";
const CORE_COLUMNS = DELIVERY_CORE_COLUMNS;

/** Livrarea unei comenzi, daca a fost deja planificata (`null` altfel - unique(order_id)). */
export async function getDeliveryByOrderId(orderId: string): Promise<DeliveryRecord | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deliveries")
    .select(CORE_COLUMNS)
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new Error("Nu am putut verifica livrarea comenzii.");
  return data ? mapDelivery(data) : null;
}

/**
 * Livrarile (doar `id` + `received_at`) ale unui set de comenzi, indexate dupa
 * `order_id` - folosita de `orders/queries.ts#listOrders` pt. guard-railurile din
 * `OrderStatusActions` (butonul manual "Livrează" trebuie ascuns/confirmat in
 * functie de existenta/starea livrarii - vezi `order-status-actions.tsx`).
 * Acelasi stil ca `summarizeOrderItems`/`getLinkTypesForOrders` din
 * orders/queries.ts - o interogare simpla, agregata in JS, evita embed-uri
 * imbricate pe 2 niveluri.
 */
export async function getDeliveryGuardsForOrders(
  orderIds: string[],
): Promise<Map<string, { id: string; receivedAt: string | null }>> {
  if (orderIds.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deliveries")
    .select("id, order_id, received_at")
    .in("order_id", orderIds);
  if (error) throw new Error("Nu am putut verifica livrările comenzilor.");

  return new Map(
    (data ?? []).map((row) => [row.order_id, { id: row.id, receivedAt: row.received_at }]),
  );
}

/** Liniile comenzii asociate livrarii (produse + cantitati) - pt. avizul PDF/ecranul de detaliu. */
async function loadOrderItemLines(
  supabase: SupabaseClient,
  orderId: string,
): Promise<DeliveryItemLine[]> {
  const { data, error } = await supabase
    .from("order_items")
    .select("item_id, quantity, items(title, unit)")
    .eq("order_id", orderId)
    .order("created_at", { ascending: true });
  if (error) throw new Error("Nu am putut incarca liniile comenzii pentru livrare.");

  return (data ?? []).map((row) => ({
    itemId: row.item_id,
    itemTitle: row.items?.title ?? "-",
    unit: row.items?.unit ?? "kg",
    quantity: Number(row.quantity),
  }));
}

/** Detaliul unei livrari (comanda, client, linii) - ecranul /livrari/[id] + avizul PDF. */
export async function getDeliveryDetail(id: string): Promise<DeliveryDetail | null> {
  const supabase = await createClient();
  const { data: delivery, error } = await supabase
    .from("deliveries")
    .select(`${CORE_COLUMNS}, orders(order_number, clients(name, cui))`)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Nu am putut incarca livrarea.");
  if (!delivery) return null;

  const items = await loadOrderItemLines(supabase, delivery.order_id);

  return {
    ...mapDelivery(delivery),
    orderNumber: delivery.orders?.order_number ?? null,
    clientName: delivery.orders?.clients?.name ?? "-",
    clientCui: delivery.orders?.clients?.cui ?? "-",
    items,
  };
}

/** Lista livrarilor organizatiei (ecranul /livrari), cele mai recent planificate primele. */
export async function listDeliveries(): Promise<DeliveryListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("deliveries")
    .select(`${CORE_COLUMNS}, orders(order_number, clients(name))`)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Nu am putut incarca lista de livrari.");

  return (data ?? []).map((row) => ({
    id: row.id,
    orderId: row.order_id,
    orderNumber: row.orders?.order_number ?? null,
    clientName: row.orders?.clients?.name ?? "-",
    scheduledDate: row.scheduled_date,
    carrierName: row.carrier_name,
    vehiclePlate: row.vehicle_plate,
    declarationStatus: row.declaration_status,
    uitCode: row.uit_code,
    hasComputedRoute: row.route_selection !== null,
  }));
}
