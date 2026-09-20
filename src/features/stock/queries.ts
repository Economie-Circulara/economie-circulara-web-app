import { createClient } from "@/lib/supabase/server";
import type {
  ItemOption,
  LotProcessLink,
  LotProvenance,
  LotTraceability,
  LotWithItem,
  StockEvent,
  StockEventType,
} from "./types";

const LOT_WITH_ITEM_SELECT =
  "id, item_id, entry_date, source, provenance, location, initial_qty, remaining_qty, quality_status, is_blocked, block_reason, client_id, lot_code, created_at, items(title, unit), clients(name)";

function mapLotWithItem(row: {
  id: string;
  item_id: string;
  entry_date: string;
  source: string | null;
  provenance: LotProvenance;
  location: string | null;
  initial_qty: number;
  remaining_qty: number;
  quality_status: LotWithItem["qualityStatus"];
  is_blocked: boolean;
  block_reason: string | null;
  client_id: string | null;
  lot_code: string;
  created_at: string;
  items: { title: string; unit: LotWithItem["unit"] } | null;
  clients: { name: string } | null;
}): LotWithItem {
  return {
    id: row.id,
    lotCode: row.lot_code,
    itemId: row.item_id,
    itemTitle: row.items?.title ?? "-",
    unit: row.items?.unit ?? "kg",
    entryDate: row.entry_date,
    source: row.source,
    provenance: row.provenance,
    location: row.location,
    initialQty: Number(row.initial_qty),
    remainingQty: Number(row.remaining_qty),
    qualityStatus: row.quality_status,
    isBlocked: row.is_blocked,
    blockReason: row.block_reason,
    // Doar loturile de aport au client (migrarile 0030/0031).
    clientId: row.client_id,
    clientName: row.clients?.name ?? null,
    createdAt: row.created_at,
  };
}

export interface ListLotsFilters {
  itemId?: string;
  provenance?: LotProvenance;
}

/** Lista loturilor (cu titlu/UM item), cea mai recenta intrare prima. Ecranul /stoc. */
export async function listLots(filters: ListLotsFilters = {}): Promise<LotWithItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("lots")
    .select(LOT_WITH_ITEM_SELECT)
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.itemId) query = query.eq("item_id", filters.itemId);
  if (filters.provenance) query = query.eq("provenance", filters.provenance);

  const { data, error } = await query;
  if (error) throw new Error("Nu am putut incarca loturile.");

  return (data ?? []).map(mapLotWithItem);
}

/** Un singur lot (cu titlu/UM item + client), pentru ecranul de detaliu `/stoc/loturi/[id]`. */
export async function getLotById(id: string): Promise<LotWithItem | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lots")
    .select(LOT_WITH_ITEM_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error("Nu am putut incarca lotul.");
  if (!data) return null;

  return mapLotWithItem(data);
}

/**
 * Trasabilitate pe un singur lot - un hop, NU graful complet recursiv din
 * `src/features/certificates/traceability.ts` (acela e construit special pentru
 * loturile livrate pe o comanda si intoarce un graf Sankey pt. certificate; nu
 * pleaca de la un lot arbitrar, ci de la "delivered lines"). Aici raspundem direct
 * la doua intrebari simple pentru pagina de detaliu a lotului:
 *   - `producedBy`: ce proces a creat acest lot (daca a iesit dintr-un proces, nu
 *     dintr-o intrare directa de stoc) - din `process_outputs`.
 *   - `consumedBy`: in ce procese a fost consumat acest lot (poate fi 0, 1 sau mai
 *     multe, daca lotul a fost consumat in transe) - din `process_inputs`.
 * Fiecare proces gasit are propriul ecran `/productie/[id]` cu graful Sankey
 * complet al ACELUI proces, daca utilizatorul vrea sa aprofundeze.
 */
export async function getLotTraceability(lotId: string): Promise<LotTraceability> {
  const supabase = await createClient();

  const [outputResult, inputResult] = await Promise.all([
    supabase
      .from("process_outputs")
      .select("quantity, processes(id, type, status, created_at)")
      .eq("lot_id", lotId),
    supabase
      .from("process_inputs")
      .select("quantity, processes(id, type, status, created_at)")
      .eq("lot_id", lotId),
  ]);

  if (outputResult.error || inputResult.error) {
    throw new Error("Nu am putut incarca trasabilitatea lotului.");
  }

  const toLink = (row: {
    quantity: number;
    processes: { id: string; type: LotProcessLink["type"]; status: LotProcessLink["status"]; created_at: string } | null;
  }): LotProcessLink | null =>
    row.processes
      ? {
          processId: row.processes.id,
          type: row.processes.type,
          status: row.processes.status,
          quantity: Number(row.quantity),
          createdAt: row.processes.created_at,
        }
      : null;

  // Un lot e produs de cel mult un proces (fiecare lot se creeaza o singura data),
  // dar tratam defensiv `process_outputs` ca pe o lista (nicio constrangere UNIQUE
  // la nivel de baza de date pe `lot_id` in acel tabel).
  const producedBy = (outputResult.data ?? []).map(toLink).find((link) => link !== null) ?? null;
  const consumedBy = (inputResult.data ?? [])
    .map(toLink)
    .filter((link): link is LotProcessLink => link !== null);

  return { producedBy, consumedBy };
}

/** Itemii organizatiei curente, pentru select-ul din formularul de adaugare lot. */
export async function listItemOptions(): Promise<ItemOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("items").select("id, title, unit").order("title");
  if (error) throw new Error("Nu am putut incarca lista de materiale.");

  return (data ?? []).map((row) => ({ id: row.id, title: row.title, unit: row.unit }));
}

export interface ListStockEventsFilters {
  itemId?: string;
  /** Restrange jurnalul la un singur lot - folosit de ecranul de detaliu lot. */
  lotId?: string;
  eventType?: StockEventType;
  /** ISO datetime - inclusiv. */
  from?: string;
  /** ISO datetime - inclusiv. */
  to?: string;
  /** Implicit 500 - folosit si de exportul CSV (fara plafon suplimentar in UI). */
  limit?: number;
}

/** Jurnalul de miscari de stoc (audit trail), cel mai recent eveniment primul. */
export async function listStockEvents(filters: ListStockEventsFilters = {}): Promise<StockEvent[]> {
  const supabase = await createClient();
  let query = supabase
    .from("stock_events")
    .select(
      "id, item_id, lot_id, event_type, quantity, reason, order_id, process_id, created_by, created_at, items(title), profiles(full_name, email)",
    )
    .order("created_at", { ascending: false });

  if (filters.itemId) query = query.eq("item_id", filters.itemId);
  if (filters.lotId) query = query.eq("lot_id", filters.lotId);
  if (filters.eventType) query = query.eq("event_type", filters.eventType);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  const { data, error } = await query.limit(filters.limit ?? 500);
  if (error) throw new Error("Nu am putut incarca jurnalul de stoc.");

  return (data ?? []).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemTitle: row.items?.title ?? "-",
    lotId: row.lot_id,
    eventType: row.event_type,
    quantity: Number(row.quantity),
    reason: row.reason,
    orderId: row.order_id,
    processId: row.process_id,
    createdBy: row.created_by,
    createdByName: row.profiles?.full_name ?? row.profiles?.email ?? null,
    createdAt: row.created_at,
  }));
}
