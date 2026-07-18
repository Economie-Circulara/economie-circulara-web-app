"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import type { OrderFormState, OrderTransitionState } from "./action-state";
import { onOrderStatusChanged } from "./notifications";
import { getOrderStatus } from "./queries";
import {
  acceptOrder,
  cancelOrder,
  createOrderWithItems,
  sendOrder,
  setOrderStatus,
} from "./service";
import { assertOrderTransition } from "./state-machine";
import type { OrderLineInput, OrderStatus } from "./types";

function clean(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s.length ? s : null;
}

function parseQty(value: FormDataEntryValue | null): number | null {
  const s = clean(value);
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Liniile comenzii vin ca perechi de campuri repetate `item_id`/`quantity` (aceeasi
 * pozitie in FormData = aceeasi linie) — vezi `OrderLinesEditor` (client component),
 * care randeaza cate un input pentru fiecare linie din starea locala. Liniile
 * incomplete (item lipsa sau cantitate invalida) sunt ignorate silentios aici;
 * `createOrderAction` respinge cererea daca nu ramane nicio linie valida.
 */
function readLines(formData: FormData): OrderLineInput[] {
  const itemIds = formData.getAll("item_id");
  const quantities = formData.getAll("quantity");
  const lines: OrderLineInput[] = [];

  for (let i = 0; i < itemIds.length; i++) {
    const itemId = clean(itemIds[i] ?? null);
    const quantity = parseQty(quantities[i] ?? null);
    if (itemId && quantity) lines.push({ itemId, quantity });
  }
  return lines;
}

/** Creeaza o comanda noua in numele unui client (`created_by_admin=true`) — doar staff. */
export async function createOrderAction(
  _prev: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const user = await requireRole(["admin", "operator"]);
  if (!user.organizationId) {
    return { error: "Utilizatorul curent nu are o organizație asociată." };
  }

  const clientId = clean(formData.get("client_id"));
  if (!clientId) return { error: "Alege un client." };

  const lines = readLines(formData);
  if (lines.length === 0) {
    return { error: "Adaugă cel puțin o linie (item vandabil + cantitate)." };
  }

  let orderId: string;
  try {
    const order = await createOrderWithItems({
      organizationId: user.organizationId,
      clientId,
      createdByAdmin: true,
      deliveryAddressId: clean(formData.get("delivery_address_id")),
      deliveryDate: clean(formData.get("delivery_date")),
      notes: clean(formData.get("notes")),
      lines,
    });
    orderId = order.id;
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut crea comanda." };
  }

  revalidatePath("/comenzi");
  redirect(`/comenzi/${orderId}`);
}

/**
 * Executa o tranzitie de status care NU are efecte de stoc (send/deliver/close):
 * verifica masina de stari fata de statusul curent (citit direct din DB — staff-ul
 * are RLS `FOR ALL`, deci fara garda de tranzitie la nivel de DB pentru el, spre
 * deosebire de client — vezi 0003_client_write_hardening.sql), aplica schimbarea,
 * apoi emite `onOrderStatusChanged`.
 */
async function runPlainTransition(
  orderId: string,
  organizationId: string | null,
  to: OrderStatus,
  apply: () => Promise<{ id: string; clientId: string }>,
): Promise<OrderTransitionState> {
  try {
    const currentStatus = await getOrderStatus(orderId);
    if (!currentStatus) return { error: "Comanda nu există sau nu este accesibilă." };
    assertOrderTransition(currentStatus, to);

    const order = await apply();
    await onOrderStatusChanged({
      orderId: order.id,
      organizationId: organizationId ?? "",
      clientId: order.clientId,
      fromStatus: currentStatus,
      toStatus: to,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Operațiune eșuată." };
  }

  revalidatePath("/comenzi");
  revalidatePath(`/comenzi/${orderId}`);
  return { error: null };
}

/** Trimite o comanda draft catre client: aloca numarul si seteaza status `sent`. */
export async function sendOrderAction(
  _prev: OrderTransitionState,
  formData: FormData,
): Promise<OrderTransitionState> {
  const user = await requireRole(["admin", "operator"]);
  const orderId = clean(formData.get("order_id"));
  if (!orderId) return { error: "Comandă invalidă." };
  if (!user.organizationId) return { error: "Utilizatorul curent nu are o organizație asociată." };

  return runPlainTransition(orderId, user.organizationId, "sent", () =>
    sendOrder(orderId, user.organizationId as string),
  );
}

/**
 * Accepta o comanda `sent`: scade stocul FIFO pentru fiecare linie (RPC
 * `accept_order`, atomic — stoc insuficient face rollback complet, comanda ramane
 * `sent`). Masina de stari e validata si aici (client-side/TS), dar sursa de
 * adevar a atomicitatii e RPC-ul din 0007_orders_ops.sql.
 */
export async function acceptOrderAction(
  _prev: OrderTransitionState,
  formData: FormData,
): Promise<OrderTransitionState> {
  const user = await requireRole(["admin", "operator"]);
  const orderId = clean(formData.get("order_id"));
  if (!orderId) return { error: "Comandă invalidă." };

  try {
    const currentStatus = await getOrderStatus(orderId);
    if (!currentStatus) return { error: "Comanda nu există sau nu este accesibilă." };
    assertOrderTransition(currentStatus, "accepted");

    const order = await acceptOrder(orderId);
    await onOrderStatusChanged({
      orderId: order.id,
      organizationId: user.organizationId ?? "",
      clientId: order.clientId,
      fromStatus: currentStatus,
      toStatus: "accepted",
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut accepta comanda." };
  }

  revalidatePath("/comenzi");
  revalidatePath(`/comenzi/${orderId}`);
  return { error: null };
}

/**
 * Anuleaza o comanda (draft/sent/accepted). Daca era `accepted`, RPC-ul
 * `cancel_order` reface stocul consumat la acceptare (atomic) inainte de a seta
 * `status='cancelled'`.
 */
export async function cancelOrderAction(
  _prev: OrderTransitionState,
  formData: FormData,
): Promise<OrderTransitionState> {
  const user = await requireRole(["admin", "operator"]);
  const orderId = clean(formData.get("order_id"));
  if (!orderId) return { error: "Comandă invalidă." };

  try {
    const currentStatus = await getOrderStatus(orderId);
    if (!currentStatus) return { error: "Comanda nu există sau nu este accesibilă." };
    assertOrderTransition(currentStatus, "cancelled");

    const order = await cancelOrder(orderId);
    await onOrderStatusChanged({
      orderId: order.id,
      organizationId: user.organizationId ?? "",
      clientId: order.clientId,
      fromStatus: currentStatus,
      toStatus: "cancelled",
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut anula comanda." };
  }

  revalidatePath("/comenzi");
  revalidatePath(`/comenzi/${orderId}`);
  return { error: null };
}

/** Marcheaza o comanda acceptata drept livrata (fara livrari partiale). */
export async function deliverOrderAction(
  _prev: OrderTransitionState,
  formData: FormData,
): Promise<OrderTransitionState> {
  const user = await requireRole(["admin", "operator"]);
  const orderId = clean(formData.get("order_id"));
  if (!orderId) return { error: "Comandă invalidă." };

  return runPlainTransition(orderId, user.organizationId, "delivered", () =>
    setOrderStatus(orderId, "delivered"),
  );
}

/**
 * Inchide o comanda livrata. Punct de intrare pentru Task G (certificat de
 * trasabilitate, generat automat la inchiderea comenzii — AGENTS.md §4):
 * `onOrderStatusChanged` primeste evenimentul cu `toStatus: 'closed'`, Task G
 * branseaza acolo generarea certificatului (snapshot trasabilitate + PDF +
 * Storage) fara sa mai modifice acest fisier.
 */
export async function closeOrderAction(
  _prev: OrderTransitionState,
  formData: FormData,
): Promise<OrderTransitionState> {
  const user = await requireRole(["admin", "operator"]);
  const orderId = clean(formData.get("order_id"));
  if (!orderId) return { error: "Comandă invalidă." };

  return runPlainTransition(orderId, user.organizationId, "closed", () =>
    setOrderStatus(orderId, "closed"),
  );
}
