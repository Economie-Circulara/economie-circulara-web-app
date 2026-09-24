"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { InsufficientStockError } from "@/features/stock/service";
import type { OrderFormState, OrderTransitionState } from "./action-state";
import { onOrderStatusChanged } from "./notifications";
import { getOrderStatus } from "./queries";
import { ORDER_TYPE_OPTIONS } from "./labels";
import {
  acceptIntakeOrder,
  acceptOrder,
  cancelOrder,
  createOrderWithItems,
  deleteDraftOrder,
  sendOrder,
  setOrderStatus,
  updateOrder,
} from "./service";
import { assertOrderTransition } from "./state-machine";
import type { OrderLineInput, OrderStatus, OrderType } from "./types";

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
 * pozitie in FormData = aceeasi linie) - vezi `OrderLinesEditor` (client component),
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

/**
 * Tipul comenzii, citit din formular. Fara default: comanda trebuie sa declare
 * explicit sensul stocului (vezi migrarea 0030 si `OrderEditorValue.orderType`).
 */
function readOrderType(formData: FormData): OrderType | null {
  const raw = clean(formData.get("order_type"));
  return ORDER_TYPE_OPTIONS.find((type) => type === raw) ?? null;
}

/** Creeaza o comanda noua in numele unui client (`created_by_admin=true`) - doar staff. */
export async function createOrderAction(
  _prev: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const user = await requireRole(["admin", "operator"]);
  if (!user.organizationId) {
    return { error: "Utilizatorul curent nu are o organizație asociată." };
  }

  const orderType = readOrderType(formData);
  if (!orderType) return { error: "Alege tipul comenzii (material, serviciu sau aport)." };

  const clientId = clean(formData.get("client_id"));
  if (!clientId) return { error: "Alege un client." };

  const lines = readLines(formData);
  if (lines.length === 0) {
    return { error: "Adaugă cel puțin o linie (item + cantitate)." };
  }

  let orderId: string;
  try {
    const order = await createOrderWithItems({
      organizationId: user.organizationId,
      clientId,
      orderType,
      createdByAdmin: true,
      deliveryAddressId: clean(formData.get("delivery_address_id")),
      deliveryDate: clean(formData.get("delivery_date")),
      expectedReturnDate: clean(formData.get("expected_return_date")),
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
 * Actualizeaza o comanda `draft` existenta (ecranul /comenzi/[id]/edit) - doar
 * staff. Acelasi tipar ca `createOrderAction` (validare campuri + linii, apoi
 * apel catre service), dar catre `updateOrder`, care respinge server-side orice
 * comanda ce nu mai e `draft`.
 */
export async function updateOrderAction(
  _prev: OrderFormState,
  formData: FormData,
): Promise<OrderFormState> {
  const user = await requireRole(["admin", "operator"]);
  if (!user.organizationId) {
    return { error: "Utilizatorul curent nu are o organizație asociată." };
  }

  const orderId = clean(formData.get("order_id"));
  if (!orderId) return { error: "Comandă invalidă." };

  const orderType = readOrderType(formData);
  if (!orderType) return { error: "Alege tipul comenzii (material, serviciu sau aport)." };

  const clientId = clean(formData.get("client_id"));
  if (!clientId) return { error: "Alege un client." };

  const lines = readLines(formData);
  if (lines.length === 0) {
    return { error: "Adaugă cel puțin o linie (item vandabil + cantitate)." };
  }

  try {
    await updateOrder({
      orderId,
      organizationId: user.organizationId,
      orderType,
      clientId,
      deliveryAddressId: clean(formData.get("delivery_address_id")),
      deliveryDate: clean(formData.get("delivery_date")),
      expectedReturnDate: clean(formData.get("expected_return_date")),
      notes: clean(formData.get("notes")),
      lines,
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut actualiza comanda." };
  }

  revalidatePath("/comenzi");
  revalidatePath(`/comenzi/${orderId}`);
  redirect(`/comenzi/${orderId}`);
}

/**
 * Executa o tranzitie de status care NU are efecte de stoc (send/deliver/close):
 * verifica masina de stari fata de statusul curent (citit direct din DB - staff-ul
 * are RLS `FOR ALL`, deci fara garda de tranzitie la nivel de DB pentru el, spre
 * deosebire de client - vezi 0003_client_write_hardening.sql), aplica schimbarea,
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
 * `accept_order`, atomic - stoc insuficient face rollback complet, comanda ramane
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
    if (err instanceof InsufficientStockError) {
      return { error: err.message, insufficientStockItemId: err.itemId || null };
    }
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
 * trasabilitate, generat automat la inchiderea comenzii - AGENTS.md §4):
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

/**
 * Accepta o comanda de tip `aport` (`draft` -> `accepted`): materialul adus de
 * client intra in stoc ca loturi noi (`accept_intake_order`, migrarea 0031).
 * Primeste direct `orderId` (nu `FormData`), ca `acceptReturnAction` - e apelata
 * din `onClick`, nu dintr-un submit de formular.
 *
 * NU trece prin `assertOrderTransition`/`onOrderStatusChanged`, exact ca acceptarea
 * unui retur (vezi features/returns/actions.ts): comanda-aport nu parcurge masina
 * de stari de vanzare (draft -> sent -> ... -> closed), iar notificarile existente
 * ("Comanda ta a fost acceptată/livrată") descriu o livrare catre client, ceea ce
 * nu se intampla aici. Validarea completa (tip, status, rol) e in RPC.
 */
export async function acceptIntakeAction(orderId: string): Promise<OrderTransitionState> {
  await requireRole(["admin", "operator"]);
  if (!orderId) return { error: "Comandă invalidă." };

  try {
    await acceptIntakeOrder(orderId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut accepta aportul." };
  }

  revalidatePath("/comenzi");
  revalidatePath(`/comenzi/${orderId}`);
  revalidatePath("/stoc");
  return { error: null };
}

/**
 * Sterge (logic) o comanda `draft` - migrarea 0035. Primeste direct `orderId`
 * (legat cu `.bind` in pagina, dupa confirmarea din `ConfirmActionButton`). La
 * succes duce utilizatorul inapoi la lista (detaliul comenzii nu mai exista).
 */
export async function deleteDraftOrderAction(orderId: string): Promise<OrderTransitionState> {
  await requireRole(["admin", "operator"]);
  if (!orderId) return { error: "Comandă invalidă." };

  try {
    await deleteDraftOrder(orderId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut șterge ciorna." };
  }

  revalidatePath("/comenzi");
  redirect("/comenzi");
}
