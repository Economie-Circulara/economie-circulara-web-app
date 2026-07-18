"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/features/auth/session";
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
 * consumata si de Task H (portal client) — nu schimba forma input-ului/output-ului
 * fara sa coordonezi cu acel task.
 *
 * Permisiuni: rolul `client` poate crea retur/garanție doar pe COMENZILE PROPRII
 * (RLS `orders_client_select`/`order_links_client_insert`, 0010_returns.sql, impun
 * asta la nivel de DB — `loadOriginalOrderForReturn` arunca `ReturnNotFoundError`
 * daca RLS nu gaseste comanda). Staff-ul (admin/operator) poate crea pt. orice
 * client din organizatia proprie, la fel ca la crearea unei comenzi normale
 * (`createOrderAction`, Task E) — cu `created_by_admin=true`.
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

    revalidatePath("/comenzi");
    revalidatePath(`/comenzi/${input.originalOrderId}`);
    revalidatePath(`/comenzi/${result.returnOrderId}`);

    return result;
  } catch (err) {
    return { error: errorMessage(err, "Nu am putut crea comanda de retur.") };
  }
}

/**
 * Accepta o comanda-retur `draft`: creeaza loturile de stoc (proveniență
 * `return`) si inchide comanda-retur — DOAR staff (RPC `accept_return_order`,
 * 0010_returns.sql, respinge oricum apelul unui client cu RT004, dar verificarea
 * de rol aici da un mesaj clar si evita round-trip-ul spre DB pt. cazul comun).
 */
export async function acceptReturnAction(returnOrderId: string): Promise<AcceptReturnResult> {
  await requireRole(["admin", "operator"]);

  try {
    await acceptReturnOrder(returnOrderId);
  } catch (err) {
    return { error: errorMessage(err, "Nu am putut accepta comanda de retur.") };
  }

  revalidatePath("/comenzi");
  revalidatePath(`/comenzi/${returnOrderId}`);
  return { error: null };
}

/**
 * Itemii unei comenzi cu cantitatea inca returnabila — folosit pt. formularul de
 * retur/garanție (cantitati editabile, plafonate la ce mai poate fi returnat).
 * Orice utilizator autentificat poate citi (RLS scopeaza rezultatul la comenzile
 * accesibile lui — client vede doar ale lui, staff vede tot din organizatie).
 */
export async function getReturnableItems(orderId: string): Promise<ReturnableItem[]> {
  await requireRole(["admin", "operator", "client"]);
  return queryReturnableItems(orderId);
}
