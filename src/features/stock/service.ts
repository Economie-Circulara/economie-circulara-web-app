import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { Lot, LotProvenance, QualityStatus, StockEventType } from "./types";

type LotRow = Database["public"]["Tables"]["lots"]["Row"];

// Coduri de eroare SQL definite in supabase/migrations/0004_stock_service.sql.
const ERR_INSUFFICIENT_STOCK = "LT001";
const ERR_NOT_FOUND = "LT002";

/** Stoc insuficient pentru a acoperi cantitatea ceruta la consumul FIFO. */
export class InsufficientStockError extends Error {
  constructor(
    public readonly itemId: string,
    public readonly requestedQty: number,
    message: string,
  ) {
    super(message);
    this.name = "InsufficientStockError";
  }
}

/** Lotul cerut nu exista sau nu e accesibil organizatiei apelantului. */
export class LotNotFoundError extends Error {
  constructor(
    public readonly lotId: string,
    message: string,
  ) {
    super(message);
    this.name = "LotNotFoundError";
  }
}

function mapLot(row: LotRow): Lot {
  return {
    id: row.id,
    itemId: row.item_id,
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
  };
}

export interface CreateLotInput {
  itemId: string;
  quantity: number;
  provenance: LotProvenance;
  source?: string | null;
  /** ISO date (yyyy-mm-dd). Implicit: data curenta. */
  entryDate?: string | null;
  location?: string | null;
  qualityStatus?: QualityStatus | null;
  /** Motiv/nota atasata evenimentului `intake` din audit. */
  reason?: string | null;
}

/**
 * Creeaza un lot nou + scrie `stock_events` (tip `intake`) — atomic, prin RPC-ul
 * Postgres `create_lot` (vezi migrarea 0004 pentru justificarea SECURITY INVOKER).
 */
export async function createLot(input: CreateLotInput): Promise<Lot> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_lot", {
    p_item_id: input.itemId,
    p_quantity: input.quantity,
    p_provenance: input.provenance,
    p_source: input.source ?? null,
    p_entry_date: input.entryDate ?? null,
    p_location: input.location ?? null,
    p_quality_status: input.qualityStatus ?? null,
    p_reason: input.reason ?? null,
  });

  if (error || !data) {
    throw new Error(error?.message ?? "Nu am putut crea lotul.");
  }
  return mapLot(data);
}

export interface ConsumeFifoOptions {
  /** Selectie manuala la productie: restrange consumul strict la aceste loturi, in ordinea data. */
  manualLotIds?: string[];
  /** Implicit `consumption`. */
  eventType?: StockEventType;
  orderId?: string | null;
  processId?: string | null;
  reason?: string | null;
}

export interface ConsumedLot {
  lotId: string;
  qty: number;
}

/**
 * Consuma dintr-un item cantitatea `qty`, FIFO implicit (ordinea `entry_date`) sau
 * din loturile date explicit prin `manualLotIds` — sare loturile blocate. Atomic
 * prin RPC-ul Postgres `consume_fifo`: fie se consuma toata cantitatea ceruta, fie
 * nimic (rollback pe stoc insuficient), niciodata consum partial.
 */
export async function consumeFIFO(
  itemId: string,
  qty: number,
  options: ConsumeFifoOptions = {},
): Promise<ConsumedLot[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("consume_fifo", {
    p_item_id: itemId,
    p_qty: qty,
    p_manual_lot_ids: options.manualLotIds ?? null,
    p_event_type: options.eventType ?? null,
    p_order_id: options.orderId ?? null,
    p_process_id: options.processId ?? null,
    p_reason: options.reason ?? null,
  });

  if (error) {
    if (error.code === ERR_INSUFFICIENT_STOCK) {
      throw new InsufficientStockError(itemId, qty, error.message);
    }
    throw new Error(error.message ?? "Nu am putut consuma stocul.");
  }

  return (data ?? []).map((row) => ({ lotId: row.lot_id, qty: Number(row.qty) }));
}

export interface RecordStockEventInput {
  itemId: string;
  lotId?: string | null;
  eventType: StockEventType;
  /** Semnat: + intrare, - consum, 0 pt. evenimente fara miscare de cantitate. */
  quantity: number;
  reason?: string | null;
  orderId?: string | null;
  processId?: string | null;
}

/**
 * Inregistreaza manual un eveniment de stoc (ex. ajustare / stornare) care nu
 * trece prin `createLot`/`consumeFIFO`. NU modifica `lots.remaining_qty` — daca
 * evenimentul trebuie sa schimbe cantitatea ramasa a unui lot, foloseste
 * `createLot`/`consumeFIFO` (atomicitate lot+eveniment garantata de RPC).
 * Un singur INSERT -> atomic implicit; organizatia se deduce din item (nu se are
 * incredere in input extern), consistent cu RLS-ul de pe `stock_events`.
 */
export async function recordStockEvent(input: RecordStockEventInput): Promise<void> {
  const supabase = await createClient();

  const { data: item, error: itemError } = await supabase
    .from("items")
    .select("organization_id")
    .eq("id", input.itemId)
    .single();
  if (itemError || !item) {
    throw new Error("Item inexistent sau fara acces.");
  }

  const { error } = await supabase.from("stock_events").insert({
    organization_id: item.organization_id,
    item_id: input.itemId,
    lot_id: input.lotId ?? null,
    event_type: input.eventType,
    quantity: input.quantity,
    reason: input.reason ?? null,
    order_id: input.orderId ?? null,
    process_id: input.processId ?? null,
  });

  if (error) {
    throw new Error(error.message ?? "Nu am putut inregistra evenimentul de stoc.");
  }
}

/** Stocul disponibil (suma `remaining_qty` a loturilor nelocate) pentru un item. */
export async function getAvailableStock(itemId: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lots")
    .select("remaining_qty")
    .eq("item_id", itemId)
    .eq("is_blocked", false)
    .gt("remaining_qty", 0);

  if (error) {
    throw new Error("Nu am putut calcula stocul disponibil.");
  }
  return (data ?? []).reduce((sum, row) => sum + Number(row.remaining_qty), 0);
}

/** Blocheaza un lot cu motiv obligatoriu + scrie `stock_events` (tip `block`). */
export async function blockLot(lotId: string, reason: string): Promise<Lot> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_lot_block", {
    p_lot_id: lotId,
    p_blocked: true,
    p_reason: reason,
  });

  if (error || !data) {
    if (error?.code === ERR_NOT_FOUND) throw new LotNotFoundError(lotId, error.message);
    throw new Error(error?.message ?? "Nu am putut bloca lotul.");
  }
  return mapLot(data);
}

/** Deblocheaza un lot + scrie `stock_events` (tip `unblock`). */
export async function unblockLot(lotId: string): Promise<Lot> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_lot_block", {
    p_lot_id: lotId,
    p_blocked: false,
    p_reason: null,
  });

  if (error || !data) {
    if (error?.code === ERR_NOT_FOUND) throw new LotNotFoundError(lotId, error.message);
    throw new Error(error?.message ?? "Nu am putut debloca lotul.");
  }
  return mapLot(data);
}

// -----------------------------------------------------------------------------
// Planificare FIFO (pura, fara efecte secundare) — pt. preview in UI (ex. ecranul
// de productie, Task D: "Consum calculat (FIFO)") INAINTE de a apela `consumeFIFO`.
// Oglindeste exact algoritmul din RPC-ul `consume_fifo`; sursa de adevar la scriere
// ramane RPC-ul (atomic, pe server) — aceasta functie nu muta stoc.
// -----------------------------------------------------------------------------
export interface FifoCandidateLot {
  lotId: string;
  /** ISO date (yyyy-mm-dd) — se compara lexicografic, la fel ca `order by entry_date`. */
  entryDate: string;
  remainingQty: number;
  isBlocked: boolean;
}

export interface FifoAllocation {
  lotId: string;
  qty: number;
}

/**
 * Calculeaza alocarea FIFO (sau selectie manuala) pentru o cantitate ceruta dintr-o
 * lista de loturi candidate deja incarcate in UI. Sare loturile blocate si cele
 * fara stoc ramas. Arunca `InsufficientStockError` daca stocul disponibil nu
 * acopera cantitatea ceruta (acelasi comportament ca RPC-ul `consume_fifo`).
 */
export function planFifoConsumption(
  lots: FifoCandidateLot[],
  qty: number,
  manualLotIds?: string[],
): FifoAllocation[] {
  if (qty <= 0) {
    throw new Error("Cantitatea de consumat trebuie sa fie mai mare ca zero.");
  }

  const available = lots.filter((lot) => !lot.isBlocked && lot.remainingQty > 0);
  const ordered = manualLotIds
    ? manualLotIds
        .map((id) => available.find((lot) => lot.lotId === id))
        .filter((lot): lot is FifoCandidateLot => Boolean(lot))
    : [...available].sort((a, b) => a.entryDate.localeCompare(b.entryDate));

  const allocation: FifoAllocation[] = [];
  let remaining = qty;
  for (const lot of ordered) {
    if (remaining <= 0) break;
    const take = Math.min(lot.remainingQty, remaining);
    if (take <= 0) continue;
    allocation.push({ lotId: lot.lotId, qty: take });
    remaining -= take;
  }

  if (remaining > 0) {
    throw new InsufficientStockError(
      "",
      qty,
      `Stoc insuficient: lipsesc ${remaining} unitati din ${qty} cerute.`,
    );
  }

  return allocation;
}
