import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { listItemOptions, listLots, listStockEvents } from "./queries";

/**
 * Query builder Supabase fals: chainable (select/order/eq/gte/lte/limit intorc
 * `this`) si "thenable" (`await query` rezolva direct rezultatul final), la fel ca
 * PostgrestFilterBuilder-ul real.
 */
function makeQueryBuilder(finalResult: { data: unknown; error: unknown }) {
  const methods = ["select", "order", "eq", "gte", "lte", "limit"] as const;
  const builder: Record<string, unknown> & { then: (resolve: (v: unknown) => void) => void } = {
    then: (resolve) => resolve(finalResult),
  };
  for (const m of methods) {
    builder[m] = vi.fn(() => builder);
  }
  return builder as Record<(typeof methods)[number] | "then", ReturnType<typeof vi.fn>> & {
    then: (resolve: (v: unknown) => void) => void;
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("listLots", () => {
  it("mapeaza randurile (inclusiv item imbricat) fara filtre", async () => {
    const builder = makeQueryBuilder({
      data: [
        {
          id: "lot-1",
          item_id: "item-1",
          entry_date: "2026-07-01",
          source: "Furnizor X",
          provenance: "purchase",
          location: "Depozit A",
          initial_qty: 100,
          remaining_qty: 40,
          quality_status: "passed",
          is_blocked: false,
          block_reason: null,
          created_at: "2026-07-01T10:00:00.000Z",
          items: { title: "Argila reciclata", unit: "kg" },
        },
      ],
      error: null,
    });
    const from = vi.fn().mockReturnValue(builder);
    createClient.mockResolvedValue({ from });

    const result = await listLots();

    expect(from).toHaveBeenCalledWith("lots");
    expect(builder.eq).not.toHaveBeenCalled();
    expect(result).toEqual([
      {
        id: "lot-1",
        itemId: "item-1",
        itemTitle: "Argila reciclata",
        unit: "kg",
        entryDate: "2026-07-01",
        source: "Furnizor X",
        provenance: "purchase",
        location: "Depozit A",
        initialQty: 100,
        remainingQty: 40,
        qualityStatus: "passed",
        isBlocked: false,
        blockReason: null,
        createdAt: "2026-07-01T10:00:00.000Z",
      },
    ]);
  });

  it("aplica filtrele de item si proveniență", async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await listLots({ itemId: "item-1", provenance: "recycling" });

    expect(builder.eq).toHaveBeenCalledWith("item_id", "item-1");
    expect(builder.eq).toHaveBeenCalledWith("provenance", "recycling");
  });

  it("arunca eroare cand query-ul esueaza", async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: "db down" } });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await expect(listLots()).rejects.toThrow("Nu am putut incarca loturile.");
  });
});

describe("listItemOptions", () => {
  it("mapeaza itemii ordonati dupa titlu", async () => {
    const builder = makeQueryBuilder({
      data: [{ id: "item-1", title: "Ciment", unit: "kg" }],
      error: null,
    });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    const result = await listItemOptions();

    expect(result).toEqual([{ id: "item-1", title: "Ciment", unit: "kg" }]);
    expect(builder.order).toHaveBeenCalledWith("title");
  });
});

describe("listStockEvents", () => {
  it("aplica filtrele si limita implicita, mapeaza cine (fallback pe email)", async () => {
    const builder = makeQueryBuilder({
      data: [
        {
          id: "ev-1",
          item_id: "item-1",
          lot_id: "lot-1",
          event_type: "consumption",
          quantity: -10,
          reason: "productie",
          order_id: null,
          process_id: "proc-1",
          created_by: "user-1",
          created_at: "2026-07-02T08:00:00.000Z",
          items: { title: "Ciment" },
          profiles: { full_name: null, email: "op@test.ro" },
        },
      ],
      error: null,
    });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    const result = await listStockEvents({
      itemId: "item-1",
      eventType: "consumption",
      from: "2026-07-01T00:00:00.000Z",
      to: "2026-07-03T00:00:00.000Z",
    });

    expect(builder.eq).toHaveBeenCalledWith("item_id", "item-1");
    expect(builder.eq).toHaveBeenCalledWith("event_type", "consumption");
    expect(builder.gte).toHaveBeenCalledWith("created_at", "2026-07-01T00:00:00.000Z");
    expect(builder.lte).toHaveBeenCalledWith("created_at", "2026-07-03T00:00:00.000Z");
    expect(builder.limit).toHaveBeenCalledWith(500);
    expect(result).toEqual([
      {
        id: "ev-1",
        itemId: "item-1",
        itemTitle: "Ciment",
        lotId: "lot-1",
        eventType: "consumption",
        quantity: -10,
        reason: "productie",
        orderId: null,
        processId: "proc-1",
        createdBy: "user-1",
        createdByName: "op@test.ro",
        createdAt: "2026-07-02T08:00:00.000Z",
      },
    ]);
  });

  it("foloseste limita custom cand e data (export CSV)", async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await listStockEvents({ limit: 5000 });

    expect(builder.limit).toHaveBeenCalledWith(5000);
  });

  it("arunca eroare cand query-ul esueaza", async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: "db down" } });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await expect(listStockEvents()).rejects.toThrow("Nu am putut incarca jurnalul de stoc.");
  });
});
