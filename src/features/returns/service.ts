import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import { getReturnableItems } from "./queries";
import type { ReturnFlowType, ReturnItemInput } from "./types";

type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderStatus = Database["public"]["Enums"]["order_status"];

// Coduri de eroare definite in supabase/migrations/0010_returns.sql.
const ERR_INVALID_TRANSITION = "RT001";
const ERR_NOT_FOUND = "RT002";
const ERR_NOT_A_RETURN = "RT003";
const ERR_FORBIDDEN = "RT004";

const RETURNABLE_ORDER_STATUSES: OrderStatus[] = ["delivered", "closed"];

/** Comanda-retur/originala nu exista sau nu e accesibila apelantului (RLS). */
export class ReturnNotFoundError extends Error {
  constructor(message = "Comanda nu există sau nu este accesibilă.") {
    super(message);
    this.name = "ReturnNotFoundError";
  }
}

/** Regula de business incalcata (status invalid, cantitate ceruta > returnabila, linii lipsa). */
export class ReturnValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReturnValidationError";
  }
}

/** Apelantul nu are voie sa execute operatiunea (ex. client incearca sa accepte). */
export class ReturnPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReturnPermissionError";
  }
}

/** Tranzitia de status ceruta nu e permisa (comanda-retur nu mai e in "draft"). */
export class ReturnTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReturnTransitionError";
  }
}

function mapOrder(row: OrderRow) {
  return {
    id: row.id,
    clientId: row.client_id,
    organizationId: row.organization_id,
    orderNumber: row.order_number,
    status: row.status,
  };
}

interface OriginalOrderForReturn {
  id: string;
  organizationId: string;
  clientId: string;
  orderNumber: string | null;
  status: OrderStatus;
}

/**
 * Incarca + valideaza comanda originala pentru un retur/garantie: trebuie sa
 * existe (RLS ii filtreaza deja pe cele inaccesibile apelantului) si sa fie
 * `delivered`/`closed` (AGENTS.md/plan: "pe o comanda finalizata"). Aruncă
 * `ReturnNotFoundError`/`ReturnValidationError` altfel.
 */
export async function loadOriginalOrderForReturn(orderId: string): Promise<OriginalOrderForReturn> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, organization_id, client_id, order_number, status")
    .eq("id", orderId)
    .maybeSingle();
  if (error) throw new Error("Nu am putut încărca comanda originală.");
  if (!data) throw new ReturnNotFoundError();

  if (!RETURNABLE_ORDER_STATUSES.includes(data.status)) {
    throw new ReturnValidationError(
      `Doar comenzile livrate sau închise pot avea retur/garanție (status curent: "${data.status}").`,
    );
  }

  return {
    id: data.id,
    organizationId: data.organization_id,
    clientId: data.client_id,
    orderNumber: data.order_number,
    status: data.status,
  };
}

export interface CreateReturnOrderInput {
  originalOrderId: string;
  type: ReturnFlowType;
  items: ReturnItemInput[];
  notes?: string | null;
  /** `true` daca returul e creat de staff in numele clientului (ca la `createOrderWithItems`). */
  createdByAdmin: boolean;
}

export interface CreateReturnOrderResult {
  returnOrderId: string;
  replacementOrderId: string | null;
}

/**
 * Creeaza comanda-retur (status `draft`) legata de comanda originala prin
 * `order_links` (tip `return` sau `warranty`); pentru `warranty` creeaza si o a
 * doua comanda ("inlocuire", tot `draft`, aceleasi linii) legata prin tip
 * `replacement`. Insert-uri secventiale + compensare best-effort pe eroare (in
 * stilul `createOrderWithItems` din features/orders/service.ts) — nu exista un
 * RPC dedicat pt. creare (doar pt. acceptare, unde atomicitatea conteaza mai
 * mult: N loturi + status intr-un singur pas, vezi 0010_returns.sql).
 */
export async function createReturnOrder(
  input: CreateReturnOrderInput,
): Promise<CreateReturnOrderResult> {
  if (input.items.length === 0) {
    throw new ReturnValidationError("Adaugă cel puțin o linie de retur.");
  }

  const original = await loadOriginalOrderForReturn(input.originalOrderId);
  const returnable = await getReturnableItems(input.originalOrderId);
  const returnableByOrderItemId = new Map(returnable.map((item) => [item.orderItemId, item]));

  const lines: { itemId: string; quantity: number }[] = [];
  for (const requested of input.items) {
    if (!Number.isFinite(requested.quantity) || requested.quantity <= 0) {
      throw new ReturnValidationError("Cantitatea de retur trebuie să fie mai mare ca zero.");
    }
    const candidate = returnableByOrderItemId.get(requested.orderItemId);
    if (!candidate) {
      throw new ReturnValidationError(
        "Una dintre liniile cerute nu aparține comenzii originale sau a fost deja ștearsă.",
      );
    }
    if (requested.quantity > candidate.returnableQuantity) {
      throw new ReturnValidationError(
        `Cantitate prea mare pentru "${candidate.itemTitle}": maxim returnabil ${candidate.returnableQuantity}.`,
      );
    }
    lines.push({ itemId: candidate.itemId, quantity: requested.quantity });
  }

  const supabase = await createClient();

  const { data: returnOrder, error: returnOrderError } = await supabase
    .from("orders")
    .insert({
      organization_id: original.organizationId,
      client_id: original.clientId,
      created_by_admin: input.createdByAdmin,
      status: "draft",
      notes: input.notes ?? null,
    })
    .select()
    .single();
  if (returnOrderError || !returnOrder) {
    throw new Error(returnOrderError?.message ?? "Nu am putut crea comanda de retur.");
  }

  const cleanupOrders = async (orderIds: string[]) => {
    for (const id of orderIds) {
      await supabase.from("orders").delete().eq("id", id);
    }
  };

  const { error: returnItemsError } = await supabase.from("order_items").insert(
    lines.map((line) => ({
      organization_id: original.organizationId,
      order_id: returnOrder.id,
      item_id: line.itemId,
      quantity: line.quantity,
    })),
  );
  if (returnItemsError) {
    await cleanupOrders([returnOrder.id]);
    throw new Error("Nu am putut salva liniile comenzii de retur.");
  }

  const { error: returnLinkError } = await supabase.from("order_links").insert({
    organization_id: original.organizationId,
    link_type: input.type,
    original_order_id: original.id,
    linked_order_id: returnOrder.id,
  });
  if (returnLinkError) {
    await cleanupOrders([returnOrder.id]);
    throw new Error("Nu am putut lega comanda de retur de comanda originală.");
  }

  let replacementOrderId: string | null = null;
  if (input.type === "warranty") {
    const { data: replacementOrder, error: replacementOrderError } = await supabase
      .from("orders")
      .insert({
        organization_id: original.organizationId,
        client_id: original.clientId,
        created_by_admin: input.createdByAdmin,
        status: "draft",
        notes: `Comandă de înlocuire (garanție) pentru ${original.orderNumber ?? original.id}`,
      })
      .select()
      .single();
    if (replacementOrderError || !replacementOrder) {
      await cleanupOrders([returnOrder.id]);
      throw new Error("Nu am putut crea comanda de înlocuire.");
    }

    const { error: replacementItemsError } = await supabase.from("order_items").insert(
      lines.map((line) => ({
        organization_id: original.organizationId,
        order_id: replacementOrder.id,
        item_id: line.itemId,
        quantity: line.quantity,
      })),
    );
    if (replacementItemsError) {
      await cleanupOrders([returnOrder.id, replacementOrder.id]);
      throw new Error("Nu am putut salva liniile comenzii de înlocuire.");
    }

    const { error: replacementLinkError } = await supabase.from("order_links").insert({
      organization_id: original.organizationId,
      link_type: "replacement",
      original_order_id: original.id,
      linked_order_id: replacementOrder.id,
    });
    if (replacementLinkError) {
      await cleanupOrders([returnOrder.id, replacementOrder.id]);
      throw new Error("Nu am putut lega comanda de înlocuire de comanda originală.");
    }

    replacementOrderId = replacementOrder.id;
  }

  return { returnOrderId: returnOrder.id, replacementOrderId };
}

function throwReturnRpcError(error: { code?: string; message: string } | null): never {
  if (!error) throw new Error("Nu am putut accepta comanda de retur.");
  if (error.code === ERR_NOT_FOUND) throw new ReturnNotFoundError(error.message);
  if (error.code === ERR_NOT_A_RETURN) throw new ReturnValidationError(error.message);
  if (error.code === ERR_INVALID_TRANSITION) throw new ReturnTransitionError(error.message);
  if (error.code === ERR_FORBIDDEN) throw new ReturnPermissionError(error.message);
  throw new Error(error.message || "Nu am putut accepta comanda de retur.");
}

/**
 * Accepta o comanda-retur `draft`: creeaza un lot (provenance `return`) pentru
 * fiecare linie + seteaza `status='accepted'` — atomic, prin RPC-ul Postgres
 * `accept_return_order` (vezi 0010_returns.sql). Nu invocă
 * `orders/notifications.ts#onOrderStatusChanged` (Task F, decizie deliberata):
 * acel hook genereaza automat certificatul de trasabilitate la `toStatus ===
 * 'closed'`, ceea ce nu are sens pt. o comanda-retur (nu e o vanzare livrata
 * clientului) — vezi nota din `actions.ts`.
 */
export async function acceptReturnOrder(returnOrderId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_return_order", {
    p_return_order_id: returnOrderId,
  });
  if (error || !data) throwReturnRpcError(error);
  return mapOrder(data);
}
