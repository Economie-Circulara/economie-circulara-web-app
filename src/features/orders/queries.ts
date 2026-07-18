import { createClient } from "@/lib/supabase/server";
import type { ClientAddress } from "@/features/clients/types";
import type { ItemOption } from "@/features/items/types";
import type { OrderDetail, OrderItemRow, OrderListRow, OrderStatus } from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const qtyFormatter = new Intl.NumberFormat("ro-RO");

/** Subsetul de coloane `orders` selectat de `listOrders`/`getOrderDetail` (fara `organization_id`/`created_by`). */
interface OrderCoreRow {
  id: string;
  client_id: string;
  order_number: string | null;
  status: OrderStatus;
  created_by_admin: boolean;
  delivery_address_id: string | null;
  delivery_date: string | null;
  expected_return_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function mapOrderRow(row: OrderCoreRow): Omit<OrderListRow, "clientName" | "itemsSummary"> {
  return {
    id: row.id,
    clientId: row.client_id,
    orderNumber: row.order_number,
    status: row.status,
    createdByAdmin: row.created_by_admin,
    deliveryAddressId: row.delivery_address_id,
    deliveryDate: row.delivery_date,
    expectedReturnDate: row.expected_return_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Rezumatul liniilor pentru un set de comenzi ("Titlu ×cantitate, ..."), intr-o
 * a doua interogare simpla + agregare in JS — evita embed-uri imbricate pe 2
 * niveluri, in stilul `src/features/recipes/queries.ts#listRecipes`.
 */
async function summarizeOrderItems(
  supabase: SupabaseClient,
  orderIds: string[],
): Promise<Map<string, string>> {
  if (orderIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("order_items")
    .select("order_id, quantity, items(title)")
    .in("order_id", orderIds);
  if (error) throw new Error("Nu am putut incarca liniile comenzilor.");

  const partsByOrder = new Map<string, string[]>();
  for (const row of data ?? []) {
    const parts = partsByOrder.get(row.order_id) ?? [];
    parts.push(`${row.items?.title ?? "—"} ×${qtyFormatter.format(Number(row.quantity))}`);
    partsByOrder.set(row.order_id, parts);
  }

  const summaries = new Map<string, string>();
  for (const [orderId, parts] of partsByOrder) summaries.set(orderId, parts.join(", "));
  return summaries;
}

export interface ListOrdersFilters {
  status?: OrderStatus;
  /** Cauta in denumirea clientului SAU numarul comenzii (substring, case-insensitive). */
  search?: string;
}

/** Lista comenzilor (ecranul /comenzi): client + rezumat linii, cele mai recente primele. */
export async function listOrders(filters: ListOrdersFilters = {}): Promise<OrderListRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select(
      "id, client_id, order_number, status, created_by_admin, delivery_address_id, delivery_date, expected_return_date, notes, created_at, updated_at, clients(name)",
    )
    .order("created_at", { ascending: false });

  if (filters.status) query = query.eq("status", filters.status);

  const { data: orderRows, error } = await query;
  if (error) throw new Error("Nu am putut incarca lista de comenzi.");

  const summaries = await summarizeOrderItems(
    supabase,
    (orderRows ?? []).map((row) => row.id),
  );

  let rows: OrderListRow[] = (orderRows ?? []).map((row) => ({
    ...mapOrderRow(row),
    clientName: row.clients?.name ?? "—",
    itemsSummary: summaries.get(row.id) ?? "—",
  }));

  const search = filters.search?.trim().toLowerCase();
  if (search) {
    rows = rows.filter(
      (row) =>
        row.clientName.toLowerCase().includes(search) ||
        (row.orderNumber ?? "").toLowerCase().includes(search),
    );
  }

  return rows;
}

/**
 * Itemi vandabili (catalog client) — singurele linii permise intr-o comanda.
 * Interogare proprie (nu `listItemOptions` din features/items/queries.ts, care nu
 * filtreaza dupa `sellable`) — ramane in scope-ul acestui task.
 */
export async function listSellableItemOptions(): Promise<ItemOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .select("id, title, unit, kind")
    .eq("sellable", true)
    .order("title");
  if (error) throw new Error("Nu am putut incarca catalogul de itemi vandabili.");

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    unit: row.unit,
    kind: row.kind,
  }));
}

/**
 * Toate adresele de livrare ale organizatiei, grupate pe client — evita N
 * interogari (una per client) la incarcarea formularului de creare comanda.
 * `client_addresses` are RLS pe `organization_id`, deci un singur select intoarce
 * doar adresele organizatiei curente a staff-ului.
 */
export async function listClientAddressesGrouped(): Promise<Record<string, ClientAddress[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("client_addresses")
    .select("id, client_id, label, address, is_default, created_at")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw new Error("Nu am putut incarca adresele clientilor.");

  const byClient: Record<string, ClientAddress[]> = {};
  for (const row of data ?? []) {
    const list = byClient[row.client_id] ?? [];
    list.push({
      id: row.id,
      clientId: row.client_id,
      label: row.label,
      address: row.address,
      isDefault: row.is_default,
      createdAt: row.created_at,
    });
    byClient[row.client_id] = list;
  }
  return byClient;
}

/** Doar statusul curent al unei comenzi (fetch usor, folosit la validarea tranzitiilor). */
export async function getOrderStatus(id: string): Promise<OrderStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("orders").select("status").eq("id", id).maybeSingle();
  if (error) throw new Error("Nu am putut verifica statusul comenzii.");
  return data?.status ?? null;
}

/** Detaliul unei comenzi (client, adresa de livrare, linii) — ecranul /comenzi/[id]. */
export async function getOrderDetail(id: string): Promise<OrderDetail | null> {
  const supabase = await createClient();
  const { data: order, error } = await supabase
    .from("orders")
    .select(
      "id, client_id, order_number, status, created_by_admin, delivery_address_id, delivery_date, expected_return_date, notes, created_at, updated_at, clients(name, cui), client_addresses(address, label)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Nu am putut incarca comanda.");
  if (!order) return null;

  const { data: itemRows, error: itemsError } = await supabase
    .from("order_items")
    .select("id, item_id, quantity, items(title, unit)")
    .eq("order_id", id)
    .order("created_at", { ascending: true });
  if (itemsError) throw new Error("Nu am putut incarca liniile comenzii.");

  const items: OrderItemRow[] = (itemRows ?? []).map((row) => ({
    id: row.id,
    orderId: id,
    itemId: row.item_id,
    itemTitle: row.items?.title ?? "—",
    unit: row.items?.unit ?? "kg",
    quantity: Number(row.quantity),
  }));

  return {
    ...mapOrderRow(order),
    clientName: order.clients?.name ?? "—",
    clientCui: order.clients?.cui ?? "—",
    deliveryAddressLabel: order.client_addresses?.label ?? null,
    deliveryAddress: order.client_addresses?.address ?? null,
    items,
  };
}
