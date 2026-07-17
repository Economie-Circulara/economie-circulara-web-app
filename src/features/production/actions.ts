"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireRole } from "@/features/auth/session";
import { listLots } from "@/features/stock/queries";
import {
  InsufficientStockError,
  type FifoAllocation,
  type FifoCandidateLot,
  planFifoConsumption,
} from "@/features/stock/service";
import { getRecipeByItemId } from "@/features/recipes/queries";
import type { RecipeDetail } from "@/features/recipes/types";
import { cancelProcess, confirmProcess } from "./service";
import type { ConfirmProcessInput } from "./types";

/** Loturile disponibile (nelocate, cu stoc) ale unui item, ca sa alimentam preview-ul FIFO. */
export async function getCandidateLots(itemId: string): Promise<FifoCandidateLot[]> {
  await requireRole(["admin", "operator"]);
  const lots = await listLots({ itemId });
  return lots
    .filter((lot) => !lot.isBlocked && lot.remainingQty > 0)
    .map((lot) => ({
      lotId: lot.id,
      entryDate: lot.entryDate,
      remainingQty: lot.remainingQty,
      isBlocked: lot.isBlocked,
    }));
}

/** Rețeta unui item (sau `null` daca nu are), pentru panoul de consum/output ideal. */
export async function getRecipeForItem(itemId: string): Promise<RecipeDetail | null> {
  await requireRole(["admin", "operator"]);
  return getRecipeByItemId(itemId);
}

export interface FifoPreviewResult {
  itemId: string;
  allocation: FifoAllocation[];
  availableQty: number;
  error: string | null;
}

/**
 * Calculeaza alocarea FIFO pentru un set de componente (4a) sau pentru un item de
 * input (4b), folosind `planFifoConsumption` (helper-ul PUR din stock service) —
 * un singur apel de server action pentru toate liniile, ca sa evitam un
 * round-trip per componenta din wizard.
 */
export async function getFifoPreview(
  lines: { itemId: string; qty: number }[],
): Promise<FifoPreviewResult[]> {
  await requireRole(["admin", "operator"]);

  return Promise.all(
    lines.map(async ({ itemId, qty }) => {
      const candidates = await getCandidateLots(itemId);
      const availableQty = candidates.reduce((sum, lot) => sum + lot.remainingQty, 0);
      try {
        const allocation = planFifoConsumption(candidates, qty);
        return { itemId, allocation, availableQty, error: null };
      } catch (err) {
        const message =
          err instanceof InsufficientStockError
            ? `Stoc insuficient: disponibil ${availableQty}, necesar ${qty}.`
            : err instanceof Error
              ? err.message
              : "Nu am putut calcula consumul FIFO.";
        return { itemId, allocation: [], availableQty, error: message };
      }
    }),
  );
}

export interface ConfirmProcessState {
  error: string | null;
}

/** Confirma un proces (4a sau 4b) — pornire + finalizare atomica, apoi redirect la detaliu. */
export async function confirmProcessAction(
  input: ConfirmProcessInput,
): Promise<ConfirmProcessState> {
  await requireRole(["admin", "operator"]);

  let processId: string;
  try {
    const process = await confirmProcess(input);
    processId = process.id;
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Nu am putut confirma procesul.",
    };
  }

  revalidatePath("/productie");
  revalidatePath("/stoc");
  redirect(`/productie/${processId}`);
}

/** Anuleaza un proces neinceput/nefinalizat. */
export async function cancelProcessAction(processId: string): Promise<{ error: string | null }> {
  await requireRole(["admin", "operator"]);

  try {
    await cancelProcess(processId);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Nu am putut anula procesul." };
  }

  revalidatePath("/productie");
  revalidatePath(`/productie/${processId}`);
  return { error: null };
}
