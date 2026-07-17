import { createClient } from "@/lib/supabase/server";
import type { ProcessDetail, ProcessListRow, ProcessLotLine } from "./types";
import { sumQty } from "./calc";

/** Istoricul proceselor (cele mai recente primele) — ecranul /productie. */
export async function listProcesses(): Promise<ProcessListRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("processes")
    .select(
      "id, type, status, output_item_id, recipe_id, started_at, completed_at, created_at, items(title)",
    )
    .order("created_at", { ascending: false });

  if (error) throw new Error("Nu am putut incarca istoricul proceselor.");

  return (data ?? []).map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    outputItemId: row.output_item_id,
    outputItemTitle: row.items?.title ?? "—",
    recipeId: row.recipe_id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    createdAt: row.created_at,
  }));
}

/** Detaliul unui proces (cu input/output loturi) — ecranul /productie/[id]. */
export async function getProcessById(id: string): Promise<ProcessDetail | null> {
  const supabase = await createClient();

  const { data: process, error: processError } = await supabase
    .from("processes")
    .select(
      "id, type, status, output_item_id, recipe_id, notes, started_at, completed_at, created_at, items(title)",
    )
    .eq("id", id)
    .maybeSingle();
  if (processError) throw new Error("Nu am putut incarca procesul.");
  if (!process) return null;

  const [{ data: inputRows, error: inputError }, { data: outputRows, error: outputError }] =
    await Promise.all([
      supabase
        .from("process_inputs")
        .select("lot_id, item_id, quantity, items(title, unit), lots(provenance)")
        .eq("process_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("process_outputs")
        .select("lot_id, item_id, quantity, items(title, unit), lots(provenance)")
        .eq("process_id", id)
        .order("created_at", { ascending: true }),
    ]);
  if (inputError || outputError) {
    throw new Error("Nu am putut incarca loturile procesului.");
  }

  const inputs: ProcessLotLine[] = (inputRows ?? []).map((row) => ({
    lotId: row.lot_id,
    itemId: row.item_id,
    itemTitle: row.items?.title ?? "—",
    unit: row.items?.unit ?? "kg",
    quantity: Number(row.quantity),
    provenance: row.lots?.provenance ?? undefined,
  }));
  const outputs: ProcessLotLine[] = (outputRows ?? []).map((row) => ({
    lotId: row.lot_id,
    itemId: row.item_id,
    itemTitle: row.items?.title ?? "—",
    unit: row.items?.unit ?? "kg",
    quantity: Number(row.quantity),
    provenance: row.lots?.provenance ?? undefined,
  }));

  return {
    id: process.id,
    type: process.type,
    status: process.status,
    outputItemId: process.output_item_id,
    outputItemTitle: process.items?.title ?? "—",
    recipeId: process.recipe_id,
    notes: process.notes,
    startedAt: process.started_at,
    completedAt: process.completed_at,
    createdAt: process.created_at,
    inputs,
    outputs,
    totalInputQty: sumQty(inputs.map((line) => ({ qty: line.quantity }))),
    totalOutputQty: sumQty(outputs.map((line) => ({ qty: line.quantity }))),
  };
}
