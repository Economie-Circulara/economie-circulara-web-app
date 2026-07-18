"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/features/auth/session";
import { createOrderWithItems, sendOrder } from "@/features/orders/service";
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
 * contract ca `orders/actions.ts#readLines`) — populate de `catalog-view.tsx` din
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
 * false`): un singur pas din UI (buton „Trimite comanda", ca in mockup), desi la
 * nivel de date trece prin doua stari (`draft` -> `sent`, RLS `orders_client_update`
 * din 0003_rls_hardening.sql permite tranzitia). Nu exista rol admin/operator aici
 * — un singur user per firma-client (AGENTS.md §4), deci nicio distinctie de rol
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
    return { error: "Coșul este gol — adaugă cel puțin un produs.", orderId: null };
  }

  let orderId: string;
  try {
    const order = await createOrderWithItems({
      organizationId: user.organizationId,
      clientId: user.clientId,
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
    // numarului a esuat) — semnalam eroarea, dar orderId ramane util (utilizatorul
    // poate incerca din nou din /comenzile-mele, comanda apare acolo ca „Draft").
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
