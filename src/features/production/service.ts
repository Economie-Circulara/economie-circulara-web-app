import { createClient } from "@/lib/supabase/server";
import { InsufficientStockError } from "@/features/stock/service";
import type { Database } from "@/lib/database.types";
import type { ConfirmProcessInput } from "./types";

type ProcessRow = Database["public"]["Tables"]["processes"]["Row"];

// Coduri de eroare SQL definite in supabase/migrations/0004_stock_service.sql si
// reutilizate de RPC-urile din 0008 (confirm_process/cancel_process).
const ERR_INSUFFICIENT_STOCK = "LT001";
const ERR_NOT_FOUND = "LT002";

/** Procesul cerut nu exista, nu e accesibil, sau e deja finalizat/anulat. */
export class ProcessNotFoundError extends Error {
  constructor(
    public readonly processId: string,
    message: string,
  ) {
    super(message);
    this.name = "ProcessNotFoundError";
  }
}

/**
 * Porneste si finalizeaza atomic un proces (4a sau 4b) prin RPC-ul Postgres
 * `confirm_process` (migrarea 0008): creeaza `processes` + consuma inputurile
 * (FIFO/manual) + creeaza loturile de output + `process_inputs`/`process_outputs`.
 * Daca stocul e insuficient pentru vreo componenta, RPC-ul face rollback complet
 * (nu ramane niciun proces partial) si arunca `InsufficientStockError`.
 */
export async function confirmProcess(input: ConfirmProcessInput): Promise<ProcessRow> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_process", {
    p_type: input.type,
    p_output_item_id: input.outputItemId,
    p_recipe_id: input.recipeId ?? null,
    p_notes: input.notes ?? null,
    p_inputs: input.inputs.map((line) => ({
      item_id: line.itemId,
      lot_ids: line.lotIds,
      qty: line.qty,
    })),
    p_outputs: input.outputs.map((line) => ({
      item_id: line.itemId,
      qty: line.qty,
      provenance: line.provenance,
      source: line.source ?? null,
      location: line.location ?? null,
      quality_status: line.qualityStatus ?? null,
    })),
  });

  if (error || !data) {
    if (error?.code === ERR_INSUFFICIENT_STOCK) {
      throw new InsufficientStockError("", 0, error.message);
    }
    throw new Error(error?.message ?? "Nu am putut confirma procesul.");
  }
  return data;
}

/** Anuleaza un proces neinceput/nefinalizat (planned/in_progress/awaiting_confirmation). */
export async function cancelProcess(processId: string): Promise<ProcessRow> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("cancel_process", { p_process_id: processId });

  if (error || !data) {
    if (error?.code === ERR_NOT_FOUND) {
      throw new ProcessNotFoundError(processId, error.message);
    }
    throw new Error(error?.message ?? "Nu am putut anula procesul.");
  }
  return data;
}
