import { createClient } from "@/lib/supabase/server";
import type { ItemOption, LotProvenance, LotWithItem, StockEvent, StockEventType } from "./types";

export interface ListLotsFilters {
  itemId?: string;
  provenance?: LotProvenance;
}

/** Lista loturilor (cu titlu/UM item), cea mai recenta intrare prima. Ecranul /stoc. */
export async function listLots(filters: ListLotsFilters = {}): Promise<LotWithItem[]> {
  const supabase = await createClient();
  let query = supabase
    .from("lots")
    .select(
      "id, item_id, entry_date, source, provenance, location, initial_qty, remaining_qty, quality_status, is_blocked, block_reason, created_at, items(title, unit)",
    )
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.itemId) query = query.eq("item_id", filters.itemId);
  if (filters.provenance) query = query.eq("provenance", filters.provenance);

  const { data, error } = await query;
  if (error) throw new Error("Nu am putut incarca loturile.");

  return (data ?? []).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemTitle: row.items?.title ?? "—",
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
    createdAt: row.created_at,
  }));
}

/** Itemii organizatiei curente, pentru select-ul din formularul de adaugare lot. */
export async function listItemOptions(): Promise<ItemOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("items").select("id, title, unit").order("title");
  if (error) throw new Error("Nu am putut incarca lista de itemi.");

  return (data ?? []).map((row) => ({ id: row.id, title: row.title, unit: row.unit }));
}

export interface ListStockEventsFilters {
  itemId?: string;
  eventType?: StockEventType;
  /** ISO datetime — inclusiv. */
  from?: string;
  /** ISO datetime — inclusiv. */
  to?: string;
  /** Implicit 500 — folosit si de exportul CSV (fara plafon suplimentar in UI). */
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
  if (filters.eventType) query = query.eq("event_type", filters.eventType);
  if (filters.from) query = query.gte("created_at", filters.from);
  if (filters.to) query = query.lte("created_at", filters.to);

  const { data, error } = await query.limit(filters.limit ?? 500);
  if (error) throw new Error("Nu am putut incarca jurnalul de stoc.");

  return (data ?? []).map((row) => ({
    id: row.id,
    itemId: row.item_id,
    itemTitle: row.items?.title ?? "—",
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
