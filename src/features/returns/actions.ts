"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/features/auth/session";
import { onOrderStatusChanged } from "@/features/orders/notifications";
import { getOrderStatus } from "@/features/orders/queries";
import { sendOrder } from "@/features/orders/service";
import { getReturnableItems as queryReturnableItems } from "./queries";
import {
  ReturnNotFoundError,
  ReturnPermissionError,
  ReturnTransitionError,
  ReturnValidationError,
  acceptReturnOrder,
  createReturnOrder,
} from "./service";
import type {
  AcceptReturnResult,
  CreateReturnInput,
  CreateReturnResult,
  ReturnableItem,
} from "./types";

function errorMessage(err: unknown, fallback: string): string {
  if (
    err instanceof ReturnValidationError ||
    err instanceof ReturnNotFoundError ||
    err instanceof ReturnPermissionError ||
    err instanceof ReturnTransitionError
  ) {
    return err.message;
  }
  return err instanceof Error ? err.message : fallback;
}

/**
 * Creeaza o comanda-retur (sau retur + inlocuire, pt. "warranty") legata de o
 * comanda finalizata (delivered/closed). INTERFATA PUBLICA: semnatura exacta e
 * consumata si de Task H (portal client) - nu schimba forma input-ului/output-ului
 * fara sa coordonezi cu acel task.
 *
 * Permisiuni: rolul `client` poate crea retur/garanție doar pe COMENZILE PROPRII
 * (RLS `orders_client_select`/`order_links_client_insert`, 0010_returns.sql, impun
 * asta la nivel de DB - `loadOriginalOrderForReturn` arunca `ReturnNotFoundError`
 * daca RLS nu gaseste comanda). Staff-ul (admin/operator) poate crea pt. orice
 * client din organizatia proprie, la fel ca la crearea unei comenzi normale
 * (`createOrderAction`, Task E) - cu `created_by_admin=true`.
 *
 * Cererea CLIENTULUI e trimisa imediat (`draft -> sent`, cu numar - migrarea 0044):
 * pentru el e o cerere trimisa spre aprobare, nu o ciorna (acelasi tipar ca aportul,
 * 0042). La garantie se trimite si comanda de inlocuire. Cererea staff-ului ramane
 * `draft` si se accepta direct.
 */
export async function createReturnAction(input: CreateReturnInput): Promise<CreateReturnResult> {
  const user = await requireRole(["admin", "operator", "client"]);

  try {
    const result = await createReturnOrder({
      originalOrderId: input.originalOrderId,
      type: input.type,
      items: input.items,
      notes: input.notes ?? null,
      createdByAdmin: user.role !== "client",
    });

    if (user.role === "client") {
      const organizationId = user.organizationId ?? "";
      try {
        await sendOrder(result.returnOrderId, organizationId);
        if (result.replacementOrderId) await sendOrder(result.replacementOrderId, organizationId);
      } catch (err) {
        // Cererea exista (ramane "Ciornă" in /comenzile-mele) - semnalam doar trimiterea.
        revalidatePath("/comenzile-mele");
        return {
          error: `Cererea a fost salvată, dar nu a putut fi trimisă: ${errorMessage(err, "eroare necunoscută")}`,
        };
      }
      revalidatePath("/comenzile-mele");
    }

    revalidatePath("/comenzi");
    revalidatePath(`/comenzi/${input.originalOrderId}`);
    revalidatePath(`/comenzi/${result.returnOrderId}`);

    return result;
  } catch (err) {
    return { error: errorMessage(err, "Nu am putut crea comanda de retur.") };
  }
}

/**
 * Accepta o comanda-retur `draft` sau `sent` (0044): creeaza loturile de stoc (proveniență
 * `return`) si inchide comanda-retur - DOAR staff (RPC `accept_return_order`,
 * 0010_returns.sql, respinge oricum apelul unui client cu RT004, dar verificarea
 * de rol aici da un mesaj clar si evita round-trip-ul spre DB pt. cazul comun).
 */
export async function acceptReturnAction(returnOrderId: string): Promise<AcceptReturnResult> {
  const user = await requireRole(["admin", "operator"]);

  try {
    const fromStatus = await getOrderStatus(returnOrderId);
    const order = await acceptReturnOrder(returnOrderId);
    // Emailul de acceptare, cu formularea de retur ("produsele au fost recepționate").
    await onOrderStatusChanged({
      orderId: order.id,
      organizationId: user.organizationId ?? "",
      clientId: order.clientId,
      fromStatus: fromStatus ?? "draft",
      toStatus: "accepted",
      kind: "return",
    });
  } catch (err) {
    return { error: errorMessage(err, "Nu am putut accepta comanda de retur.") };
  }

  revalidatePath("/comenzi");
  revalidatePath(`/comenzi/${returnOrderId}`);
  return { error: null };
}

/**
 * Itemii unei comenzi cu cantitatea inca returnabila - folosit pt. formularul de
 * retur/garanție (cantitati editabile, plafonate la ce mai poate fi returnat).
 * Orice utilizator autentificat poate citi (RLS scopeaza rezultatul la comenzile
 * accesibile lui - client vede doar ale lui, staff vede tot din organizatie).
 */
export async function getReturnableItems(orderId: string): Promise<ReturnableItem[]> {
  await requireRole(["admin", "operator", "client"]);
  return queryReturnableItems(orderId);
}
