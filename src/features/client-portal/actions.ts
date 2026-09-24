"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { createOrderWithItems, deleteDraftOrder, sendOrder } from "@/features/orders/service";
import type { OrderLineInput } from "@/features/orders/types";
import type { ClientOrderFormState } from "./action-state";

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
 * Liniile cosului vin ca perechi de campuri repetate `item_id`/`quantity` (acelasi
 * contract ca `orders/actions.ts#readLines`) - populate de `catalog-view.tsx` din
 * starea cosului (`useCart`) chiar inainte de submit.
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
 * Creeaza + trimite o comanda in numele clientului curent (`created_by_admin:
 * false`): un singur pas din UI (buton "Trimite comanda", ca in mockup), desi la
 * nivel de date trece prin doua stari (`draft` -> `sent`, RLS `orders_client_update`
 * din 0003_rls_hardening.sql permite tranzitia). Nu exista rol admin/operator aici
 * - un singur user per firma-client (AGENTS.md §4), deci nicio distinctie de rol
 * de facut in interiorul acestei actiuni.
 */
export async function createClientOrderAction(
  _prev: ClientOrderFormState,
  formData: FormData,
): Promise<ClientOrderFormState> {
  const user = await requireRole(["client"]);
  if (!user.organizationId || !user.clientId) {
    return { error: "Contul curent nu este asociat unei firme client.", orderId: null };
  }

  const lines = readLines(formData);
  if (lines.length === 0) {
    return { error: "Coșul este gol - adaugă cel puțin un produs.", orderId: null };
  }

  let orderId: string;
  try {
    const order = await createOrderWithItems({
      organizationId: user.organizationId,
      clientId: user.clientId,
      // Portalul clientului comanda DOAR din catalogul vandabil, deci o comanda
      // clasica de material (migrarea 0030). Serviciul/aportul raman initiate de
      // staff: aportul (client -> organizatie) va primi un flux self-service
      // separat, in afara scope-ului acestui task.
      orderType: "material",
      createdByAdmin: false,
      deliveryAddressId: clean(formData.get("delivery_address_id")),
      deliveryDate: clean(formData.get("delivery_date")),
      notes: clean(formData.get("notes")),
      lines,
    });
    orderId = order.id;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Nu am putut crea comanda.",
      orderId: null,
    };
  }

  try {
    await sendOrder(orderId, user.organizationId);
  } catch (err) {
    // Comanda a fost salvata ca draft, dar nu a putut fi trimisa (ex. generarea
    // numarului a esuat) - semnalam eroarea, dar orderId ramane util (utilizatorul
    // poate incerca din nou din /comenzile-mele, comanda apare acolo ca "Ciornă").
    revalidatePath("/comenzile-mele");
    return {
      error:
        err instanceof Error
          ? `Comanda a fost salvată, dar nu a putut fi trimisă: ${err.message}`
          : "Comanda a fost salvată, dar nu a putut fi trimisă.",
      orderId,
    };
  }

  revalidatePath("/comenzile-mele");
  return { error: null, orderId };
}

/**
 * Creeaza o cerere de aport (client -> organizatie, materialul e adus DE CATRE
 * client, ex. moloz de demolare) in numele clientului curent: comanda de tip
 * `aport`, `created_by_admin: false`. Spre deosebire de `createClientOrderAction`
 * de mai sus, comanda RAMANE `draft` - nu se apeleaza `sendOrder` (aportul nu are
 * un pas "trimisa" separat, vezi comentariul din 0031_aport_intake.sql: staff-ul
 * accepta direct din draft, cu `AcceptIntakeButton`/`accept_intake_order`).
 * Acceptarea (care CRESTE stocul) ramane exclusiv la staff - portalul clientului
 * nu apeleaza niciodata `accept_intake_order`, doar creeaza cererea; RPC-ul are
 * oricum propria garda `app.is_staff_of` (AP004) daca ar fi apelat direct prin
 * Data API.
 */
export async function createClientAportAction(
  _prev: ClientOrderFormState,
  formData: FormData,
): Promise<ClientOrderFormState> {
  const user = await requireRole(["client"]);
  if (!user.organizationId || !user.clientId) {
    return { error: "Contul curent nu este asociat unei firme client.", orderId: null };
  }

  const lines = readLines(formData);
  if (lines.length === 0) {
    return {
      error: "Adaugă cel puțin un material, cu o cantitate estimată.",
      orderId: null,
    };
  }

  try {
    const order = await createOrderWithItems({
      organizationId: user.organizationId,
      clientId: user.clientId,
      orderType: "aport",
      createdByAdmin: false,
      deliveryAddressId: clean(formData.get("delivery_address_id")),
      deliveryDate: clean(formData.get("delivery_date")),
      notes: clean(formData.get("notes")),
      lines,
    });
    revalidatePath("/comenzile-mele");
    return { error: null, orderId: order.id };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Nu am putut trimite cererea de aport.",
      orderId: null,
    };
  }
}

/** Rezultatul stergerii unei ciorne din portal (dialogul de confirmare). */
export interface DeleteOwnDraftResult {
  error: string | null;
}

/**
 * Clientul isi sterge (logic) propria comanda `draft` din portal (migrarea 0035).
 * Autorizarea reala e in RPC-ul `delete_draft_order`: doar comanda propriei firme,
 * din organizatia lui, si doar cat e ciorna - o comanda straina da aceeasi eroare ca
 * una inexistenta. Legata cu `.bind(null, id)` in pagina; la succes duce la lista.
 */
export async function deleteOwnDraftOrderAction(orderId: string): Promise<DeleteOwnDraftResult> {
  await requireRole(["client"]);
  if (!orderId) return { error: "Comandă invalidă." };

  try {
    await deleteDraftOrder(orderId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut șterge ciorna." };
  }

  revalidatePath("/comenzile-mele");
  redirect("/comenzile-mele");
}
