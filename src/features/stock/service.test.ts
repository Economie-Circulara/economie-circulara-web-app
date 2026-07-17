import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies — vezi AGENTS.md §2.2): inlocuim complet clientul Supabase server.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import {
  InsufficientStockError,
  LotNotFoundError,
  blockLot,
  consumeFIFO,
  createLot,
  getAvailableStock,
  planFifoConsumption,
  recordStockEvent,
  unblockLot,
} from "./service";

function lotRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "lot-1",
    organization_id: "org-1",
    item_id: "item-1",
    entry_date: "2026-07-01",
    source: "Furnizor X",
    provenance: "purchase",
    location: null,
    initial_qty: 100,
    remaining_qty: 100,
    quality_status: "unchecked",
    is_blocked: false,
    block_reason: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("createLot", () => {
  it("apeleaza RPC create_lot cu argumentele corecte si mapeaza randul intors", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: lotRow(), error: null });
    createClient.mockResolvedValue({ rpc });

    const result = await createLot({
      itemId: "item-1",
      quantity: 100,
      provenance: "purchase",
      source: "Furnizor X",
    });

    expect(rpc).toHaveBeenCalledWith("create_lot", {
      p_item_id: "item-1",
      p_quantity: 100,
      p_provenance: "purchase",
      p_source: "Furnizor X",
      p_entry_date: null,
      p_location: null,
      p_quality_status: null,
      p_reason: null,
    });
    expect(result).toEqual({
      id: "lot-1",
      itemId: "item-1",
      entryDate: "2026-07-01",
      source: "Furnizor X",
      provenance: "purchase",
      location: null,
      initialQty: 100,
      remainingQty: 100,
      qualityStatus: "unchecked",
      isBlocked: false,
      blockReason: null,
      createdAt: "2026-07-01T00:00:00.000Z",
    });
  });

  it("arunca eroare cand RPC esueaza", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom", code: "XX" } });
    createClient.mockResolvedValue({ rpc });

    await expect(
      createLot({ itemId: "item-1", quantity: 1, provenance: "purchase" }),
    ).rejects.toThrow("boom");
  });
});

describe("consumeFIFO", () => {
  it("returneaza loturile consumate, in ordinea data de RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        { lot_id: "lot-1", qty: 30 },
        { lot_id: "lot-2", qty: 20 },
      ],
      error: null,
    });
    createClient.mockResolvedValue({ rpc });

    const result = await consumeFIFO("item-1", 50, { reason: "productie" });

    expect(rpc).toHaveBeenCalledWith("consume_fifo", {
      p_item_id: "item-1",
      p_qty: 50,
      p_manual_lot_ids: null,
      p_event_type: null,
      p_order_id: null,
      p_process_id: null,
      p_reason: "productie",
    });
    expect(result).toEqual([
      { lotId: "lot-1", qty: 30 },
      { lotId: "lot-2", qty: 20 },
    ]);
  });

  it("trece manualLotIds catre RPC cand e specificat (selectie manuala)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ lot_id: "lot-9", qty: 5 }], error: null });
    createClient.mockResolvedValue({ rpc });

    await consumeFIFO("item-1", 5, { manualLotIds: ["lot-9"] });

    expect(rpc).toHaveBeenCalledWith(
      "consume_fifo",
      expect.objectContaining({ p_manual_lot_ids: ["lot-9"] }),
    );
  });

  it("arunca InsufficientStockError cand RPC raporteaza codul LT001 (stoc insuficient)", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Stoc insuficient pentru itemul item-1", code: "LT001" },
    });
    createClient.mockResolvedValue({ rpc });

    await expect(consumeFIFO("item-1", 1000)).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it("arunca eroare generica pentru alte coduri de eroare", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "alta eroare", code: "XX" } });
    createClient.mockResolvedValue({ rpc });

    await expect(consumeFIFO("item-1", 10)).rejects.toThrow("alta eroare");
  });
});

describe("recordStockEvent", () => {
  function mockFrom({
    item,
    insertError,
  }: { item?: { organization_id: string } | null; insertError?: { message: string } } = {}) {
    const insert = vi.fn().mockResolvedValue({ error: insertError ?? null });
    const from = vi.fn((table: string) => {
      if (table === "items") {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi
                .fn()
                .mockResolvedValue({ data: item ?? null, error: item ? null : { message: "no" } }),
            }),
          }),
        };
      }
      if (table === "stock_events") {
        return { insert };
      }
      throw new Error(`tabel neasteptat in test: ${table}`);
    });
    return { from, insert };
  }

  it("deduce organization_id din item si insereaza evenimentul", async () => {
    const { from, insert } = mockFrom({ item: { organization_id: "org-1" } });
    createClient.mockResolvedValue({ from });

    await recordStockEvent({
      itemId: "item-1",
      eventType: "adjustment",
      quantity: -5,
      reason: "corectie inventar",
    });

    expect(insert).toHaveBeenCalledWith({
      organization_id: "org-1",
      item_id: "item-1",
      lot_id: null,
      event_type: "adjustment",
      quantity: -5,
      reason: "corectie inventar",
      order_id: null,
      process_id: null,
    });
  });

  it("arunca eroare cand itemul nu exista sau nu e accesibil (izolare tenant)", async () => {
    const { from } = mockFrom({ item: null });
    createClient.mockResolvedValue({ from });

    await expect(
      recordStockEvent({ itemId: "item-x", eventType: "adjustment", quantity: 1 }),
    ).rejects.toThrow("Item inexistent");
  });
});

describe("getAvailableStock", () => {
  it("insumeaza remaining_qty al loturilor nelocate cu stoc", async () => {
    const gt = vi
      .fn()
      .mockResolvedValue({ data: [{ remaining_qty: 10 }, { remaining_qty: 15.5 }], error: null });
    const eqBlocked = vi.fn().mockReturnValue({ gt });
    const eqItem = vi.fn().mockReturnValue({ eq: eqBlocked });
    const select = vi.fn().mockReturnValue({ eq: eqItem });
    const from = vi.fn().mockReturnValue({ select });
    createClient.mockResolvedValue({ from });

    const total = await getAvailableStock("item-1");

    expect(total).toBe(25.5);
    expect(from).toHaveBeenCalledWith("lots");
  });
});

describe("blockLot / unblockLot", () => {
  it("blockLot apeleaza RPC set_lot_block cu p_blocked=true si motivul dat", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: lotRow({ is_blocked: true, block_reason: "contaminat" }),
      error: null,
    });
    createClient.mockResolvedValue({ rpc });

    const lot = await blockLot("lot-1", "contaminat");

    expect(rpc).toHaveBeenCalledWith("set_lot_block", {
      p_lot_id: "lot-1",
      p_blocked: true,
      p_reason: "contaminat",
    });
    expect(lot.isBlocked).toBe(true);
    expect(lot.blockReason).toBe("contaminat");
  });

  it("unblockLot apeleaza RPC set_lot_block cu p_blocked=false", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: lotRow({ is_blocked: false, block_reason: null }), error: null });
    createClient.mockResolvedValue({ rpc });

    const lot = await unblockLot("lot-1");

    expect(rpc).toHaveBeenCalledWith("set_lot_block", {
      p_lot_id: "lot-1",
      p_blocked: false,
      p_reason: null,
    });
    expect(lot.isBlocked).toBe(false);
  });

  it("arunca LotNotFoundError cand RPC raporteaza codul LT002", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "not found", code: "LT002" } });
    createClient.mockResolvedValue({ rpc });

    await expect(blockLot("lot-x", "motiv")).rejects.toBeInstanceOf(LotNotFoundError);
  });
});

describe("planFifoConsumption (preview client-side, oglindeste RPC-ul consume_fifo)", () => {
  const lots = [
    { lotId: "lot-old", entryDate: "2026-01-10", remainingQty: 20, isBlocked: false },
    { lotId: "lot-blocked", entryDate: "2026-01-05", remainingQty: 100, isBlocked: true },
    { lotId: "lot-mid", entryDate: "2026-02-01", remainingQty: 30, isBlocked: false },
    { lotId: "lot-new", entryDate: "2026-03-01", remainingQty: 50, isBlocked: false },
  ];

  it("consuma FIFO in ordinea entry_date, peste mai multe loturi", () => {
    expect(planFifoConsumption(lots, 35)).toEqual([
      { lotId: "lot-old", qty: 20 },
      { lotId: "lot-mid", qty: 15 },
    ]);
  });

  it("sare loturile blocate chiar daca sunt cele mai vechi", () => {
    const allocation = planFifoConsumption(lots, 100);
    expect(allocation.find((a) => a.lotId === "lot-blocked")).toBeUndefined();
    expect(allocation.reduce((sum, a) => sum + a.qty, 0)).toBe(100);
  });

  it("respecta selectia manuala: restrange la loturile date, in ordinea data", () => {
    expect(planFifoConsumption(lots, 40, ["lot-new", "lot-old"])).toEqual([
      { lotId: "lot-new", qty: 40 },
    ]);
  });

  it("arunca InsufficientStockError cand stocul disponibil nu acopera cererea", () => {
    expect(() => planFifoConsumption(lots, 1000)).toThrow(InsufficientStockError);
  });
});
