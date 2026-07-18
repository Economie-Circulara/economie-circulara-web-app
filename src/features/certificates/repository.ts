import { createClient } from "@/lib/supabase/server";
import type {
  DeliveredLotLine,
  RawLot,
  RawProcess,
  RawProcessInput,
  RawProcessOutput,
  TraceabilityRawData,
} from "./types";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const MAX_LEVELS = 25;

/**
 * Fetch iterativ (pe niveluri, batch-uit cu `.in()`) al datelor brute necesare
 * traversarii graf-ului de trasabilitate — vezi `traceability.ts` pentru
 * algoritmul PUR care consuma acest rezultat. Foloseste clientul UTILIZATORULUI
 * (RLS ramane in vigoare — staff-ul are acces `for all` pe toate tabelele
 * atinse aici, deci izolarea multi-tenant se aplica natural, fara verificari
 * suplimentare in acest modul).
 *
 * Pornim de la loturile efectiv CONSUMATE la acceptarea comenzii (`stock_events`
 * cu `order_id` + `event_type='consumption'`, scrise de `accept_order`/
 * `consume_fifo` — 0004/0007) — acestea sunt loturile "livrate" pe aceasta
 * comanda. Pentru fiecare, urcam un nivel: e produs de un proces
 * (`process_outputs.lot_id`)? Daca da, adaugam procesul + input-urile lui
 * (`process_inputs`) la coada urmatorului nivel. Repetam pana la loturi fara
 * proces cunoscut (surse) sau `MAX_LEVELS` (garda anti-bucla pe date corupte).
 */
export async function fetchOrderTraceabilityRawData(
  supabase: SupabaseClient,
  orderId: string,
): Promise<TraceabilityRawData> {
  const delivered = await fetchDeliveredLots(supabase, orderId);

  const lots: Record<string, RawLot> = {};
  const processes: Record<string, RawProcess> = {};
  const outputByLot: Record<string, RawProcessOutput> = {};
  const inputsByProcess: Record<string, RawProcessInput[]> = {};

  const visitedLotIds = new Set<string>();
  let frontier = [...new Set(delivered.map((line) => line.lotId))];

  for (let level = 0; level < MAX_LEVELS && frontier.length > 0; level++) {
    const newLotIds = frontier.filter((id) => !visitedLotIds.has(id));
    newLotIds.forEach((id) => visitedLotIds.add(id));
    if (newLotIds.length === 0) break;

    await fetchLotsInto(supabase, newLotIds, lots);

    const outputRows = await fetchProcessOutputsForLots(supabase, newLotIds);
    const processIds = new Set<string>();
    for (const row of outputRows) {
      outputByLot[row.lotId] = row;
      processIds.add(row.processId);
    }
    if (processIds.size === 0) {
      frontier = [];
      continue;
    }

    await fetchProcessesInto(supabase, [...processIds], processes);
    const inputRows = await fetchProcessInputsForProcesses(supabase, [...processIds]);
    const nextFrontier = new Set<string>();
    for (const row of inputRows) {
      const list = inputsByProcess[row.processId] ?? [];
      list.push(row);
      inputsByProcess[row.processId] = list;
      if (!visitedLotIds.has(row.lotId)) nextFrontier.add(row.lotId);
    }
    frontier = [...nextFrontier];
  }

  return { delivered, lots, processes, outputByLot, inputsByProcess };
}

async function fetchDeliveredLots(
  supabase: SupabaseClient,
  orderId: string,
): Promise<DeliveredLotLine[]> {
  const { data, error } = await supabase
    .from("stock_events")
    .select("lot_id, item_id, quantity, items(title, unit)")
    .eq("order_id", orderId)
    .eq("event_type", "consumption");
  if (error) throw new Error("Nu am putut incarca loturile livrate ale comenzii.");

  const byLot = new Map<string, DeliveredLotLine>();
  for (const row of data ?? []) {
    if (!row.lot_id) continue;
    const existing = byLot.get(row.lot_id);
    const qty = Math.abs(Number(row.quantity));
    if (existing) {
      existing.quantity += qty;
    } else {
      byLot.set(row.lot_id, {
        lotId: row.lot_id,
        itemId: row.item_id,
        itemTitle: row.items?.title ?? "—",
        unit: row.items?.unit ?? "kg",
        quantity: qty,
      });
    }
  }
  return [...byLot.values()];
}

async function fetchLotsInto(
  supabase: SupabaseClient,
  lotIds: string[],
  target: Record<string, RawLot>,
): Promise<void> {
  if (lotIds.length === 0) return;
  const { data, error } = await supabase
    .from("lots")
    .select("id, item_id, provenance, source, entry_date, items(title, unit)")
    .in("id", lotIds);
  if (error) throw new Error("Nu am putut incarca loturile din lantul de trasabilitate.");

  for (const row of data ?? []) {
    target[row.id] = {
      id: row.id,
      itemId: row.item_id,
      itemTitle: row.items?.title ?? "—",
      unit: row.items?.unit ?? "kg",
      provenance: row.provenance,
      source: row.source,
      entryDate: row.entry_date,
    };
  }
}

async function fetchProcessOutputsForLots(
  supabase: SupabaseClient,
  lotIds: string[],
): Promise<RawProcessOutput[]> {
  if (lotIds.length === 0) return [];
  const { data, error } = await supabase
    .from("process_outputs")
    .select("process_id, lot_id, quantity")
    .in("lot_id", lotIds);
  if (error) throw new Error("Nu am putut incarca procesele care au produs loturile.");

  return (data ?? []).map((row) => ({
    processId: row.process_id,
    lotId: row.lot_id,
    quantity: Number(row.quantity),
  }));
}

async function fetchProcessesInto(
  supabase: SupabaseClient,
  processIds: string[],
  target: Record<string, RawProcess>,
): Promise<void> {
  const missing = processIds.filter((id) => !target[id]);
  if (missing.length === 0) return;
  const { data, error } = await supabase
    .from("processes")
    .select("id, type, completed_at")
    .in("id", missing);
  if (error) throw new Error("Nu am putut incarca procesele din lantul de trasabilitate.");

  for (const row of data ?? []) {
    target[row.id] = { id: row.id, type: row.type, completedAt: row.completed_at };
  }
}

async function fetchProcessInputsForProcesses(
  supabase: SupabaseClient,
  processIds: string[],
): Promise<RawProcessInput[]> {
  if (processIds.length === 0) return [];
  const { data, error } = await supabase
    .from("process_inputs")
    .select("process_id, lot_id, quantity")
    .in("process_id", processIds);
  if (error) throw new Error("Nu am putut incarca loturile de intrare ale proceselor.");

  return (data ?? []).map((row) => ({
    processId: row.process_id,
    lotId: row.lot_id,
    quantity: Number(row.quantity),
  }));
}
