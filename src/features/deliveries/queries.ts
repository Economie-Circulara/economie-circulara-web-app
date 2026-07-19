import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
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
  | "created_at"
  | "updated_at"
>;

/** Exportat — reutilizat de `service.ts` dupa insert/update (aceleasi coloane selectate). */
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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Un singur literal de sir (NU concatenare cu `+`): concatenarea ar largi tipul la
// `string` simplu, iar clientul Supabase tipat are nevoie de LITERALUL exact ca sa
// infereze corect coloanele din `.select(...)` (altfel `GenericStringError`).
// prettier-ignore
export const DELIVERY_CORE_COLUMNS = "id, organization_id, order_id, scheduled_date, carrier_name, vehicle_plate, driver_name, route_origin, route_destination, uit_code, declaration_status, declaration_error, created_at, updated_at";
const CORE_COLUMNS = DELIVERY_CORE_COLUMNS;

/** Livrarea unei comenzi, daca a fost deja planificata (`null` altfel — unique(order_id)). */
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

/** Liniile comenzii asociate livrarii (produse + cantitati) — pt. avizul PDF/ecranul de detaliu. */
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
    itemTitle: row.items?.title ?? "—",
    unit: row.items?.unit ?? "kg",
    quantity: Number(row.quantity),
  }));
}

/** Detaliul unei livrari (comanda, client, linii) — ecranul /livrari/[id] + avizul PDF. */
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
    clientName: delivery.orders?.clients?.name ?? "—",
    clientCui: delivery.orders?.clients?.cui ?? "—",
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
    clientName: row.orders?.clients?.name ?? "—",
    scheduledDate: row.scheduled_date,
    carrierName: row.carrier_name,
    vehiclePlate: row.vehicle_plate,
    declarationStatus: row.declaration_status,
    uitCode: row.uit_code,
  }));
}
