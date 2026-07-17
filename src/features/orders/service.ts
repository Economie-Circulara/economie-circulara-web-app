import { createClient } from "@/lib/supabase/server";
import { InsufficientStockError } from "@/features/stock/service";
import type { Database } from "@/lib/database.types";
import type { Order, OrderLineInput, OrderStatus } from "./types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

// Coduri de eroare SQL definite in supabase/migrations/0007_orders_ops.sql, plus
// LT001 (stoc insuficient), definit in 0004_stock_service.sql si propagat de
// `accept_order` din interiorul apelului catre `consume_fifo`.
const ERR_INVALID_TRANSITION = "OR001";
const ERR_NOT_FOUND = "OR002";
const ERR_FORBIDDEN = "OR004";
const ERR_INSUFFICIENT_STOCK = "LT001";

/** Comanda nu exista sau nu e accesibila apelantului (RLS). */
export class OrderNotFoundError extends Error {
  constructor(public readonly orderId: string) {
    super("Comanda nu există sau nu este accesibilă.");
    this.name = "OrderNotFoundError";
  }
}

/** Tranzitia de status ceruta nu e permisa din statusul curent (validata si in DB). */
export class OrderTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderTransitionError";
  }
}

/** Apelantul nu are voie sa execute operatiunea (ex. client incearca sa accepte). */
export class OrderPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderPermissionError";
  }
}

function mapOrder(row: OrderRow): Order {
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

function throwOrderRpcError(
  orderId: string,
  error: { code?: string; message: string } | null,
  fallbackMessage: string,
): never {
  if (!error) throw new Error(fallbackMessage);
  if (error.code === ERR_NOT_FOUND) throw new OrderNotFoundError(orderId);
  if (error.code === ERR_INVALID_TRANSITION) throw new OrderTransitionError(error.message);
  if (error.code === ERR_FORBIDDEN) throw new OrderPermissionError(error.message);
  if (error.code === ERR_INSUFFICIENT_STOCK) {
    throw new InsufficientStockError("", 0, error.message);
  }
  throw new Error(error.message || fallbackMessage);
}

/** Numar de comanda secvential nou, per organizatie/an (RPC `generate_order_number`). */
export async function generateOrderNumber(organizationId: string): Promise<string> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_order_number", {
    p_org: organizationId,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Nu am putut genera numărul comenzii.");
  }
  return data;
}

/**
 * Trimite o comanda `draft`: aloca numarul (RPC `generate_order_number`) apoi
 * seteaza `status='sent'` + `order_number` intr-un singur UPDATE. Nota: alocarea
 * numarului si acest UPDATE sunt doi pasi separati (vezi comentariul din
 * 0007_orders_ops.sql) — daca UPDATE-ul esueaza dupa alocare, numarul e "ars"
 * (secventa sare un numar), trade-off acceptat, comun la generatoare de secventa.
 */
export async function sendOrder(orderId: string, organizationId: string): Promise<Order> {
  const orderNumber = await generateOrderNumber(organizationId);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ status: "sent", order_number: orderNumber })
    .eq("id", orderId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Nu am putut trimite comanda.");
  }
  return mapOrder(data);
}

/** Seteaza direct statusul (fara efecte de stoc) — folosit pentru accepted->delivered->closed. */
export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<Order> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", orderId)
    .select()
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Nu am putut actualiza statusul comenzii.");
  }
  return mapOrder(data);
}

/**
 * Accepta o comanda `sent`: consuma FIFO stocul fiecarei linii si seteaza
 * `status='accepted'` — atomic, prin RPC-ul Postgres `accept_order` (vezi
 * 0007_orders_ops.sql). Stoc insuficient (LT001) sau tranzitie invalida (OR001)
 * fac rollback complet — comanda ramane `sent`.
 */
export async function acceptOrder(orderId: string): Promise<Order> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_order", { p_order_id: orderId });
  if (error || !data) throwOrderRpcError(orderId, error, "Nu am putut accepta comanda.");
  return mapOrder(data);
}

/**
 * Anuleaza o comanda (din draft/sent/accepted); daca era `accepted`, reface stocul
 * consumat la acceptare — atomic, prin RPC-ul Postgres `cancel_order`.
 */
export async function cancelOrder(orderId: string): Promise<Order> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_order", { p_order_id: orderId });
  if (error || !data) throwOrderRpcError(orderId, error, "Nu am putut anula comanda.");
  return mapOrder(data);
}

export interface CreateOrderInput {
  organizationId: string;
  clientId: string;
  createdByAdmin: boolean;
  deliveryAddressId?: string | null;
  deliveryDate?: string | null;
  notes?: string | null;
  lines: OrderLineInput[];
}

/**
 * Creeaza o comanda noua in status `draft` + liniile ei (doua insert-uri: orders,
 * order_items). Daca al doilea esueaza, sterge comanda deja creata (compensare
 * best-effort, in stilul `uploadDocument` din features/documents/service.ts) ca sa
 * nu ramana o comanda goala, orfana.
 */
export async function createOrderWithItems(input: CreateOrderInput): Promise<Order> {
  if (input.lines.length === 0) {
    throw new Error("Comanda trebuie să aibă cel puțin o linie.");
  }

  const supabase = await createClient();
  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      organization_id: input.organizationId,
      client_id: input.clientId,
      created_by_admin: input.createdByAdmin,
      delivery_address_id: input.deliveryAddressId ?? null,
      delivery_date: input.deliveryDate ?? null,
      notes: input.notes ?? null,
      status: "draft",
    })
    .select()
    .single();

  if (orderError || !order) {
    throw new Error(orderError?.message ?? "Nu am putut crea comanda.");
  }

  const { error: itemsError } = await supabase.from("order_items").insert(
    input.lines.map((line) => ({
      organization_id: input.organizationId,
      order_id: order.id,
      item_id: line.itemId,
      quantity: line.quantity,
    })),
  );

  if (itemsError) {
    await supabase.from("orders").delete().eq("id", order.id);
    throw new Error("Nu am putut salva liniile comenzii.");
  }

  return mapOrder(order);
}
