import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import {
  getLotById,
  getLotTraceability,
  listItemOptions,
  listLots,
  listStockEvents,
} from "./queries";

/**
 * Query builder Supabase fals: chainable (select/order/eq/gte/lte/limit/maybeSingle
 * intorc `this`) si "thenable" (`await query` rezolva direct rezultatul final), la
 * fel ca PostgrestFilterBuilder-ul real.
 */
function makeQueryBuilder(finalResult: { data: unknown; error: unknown }) {
  const methods = ["select", "order", "eq", "gte", "lte", "limit", "is"] as const;
  const builder: Record<string, unknown> & { then: (resolve: (v: unknown) => void) => void } = {
    then: (resolve) => resolve(finalResult),
  };
  for (const m of methods) {
    builder[m] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn(() => finalResult);
  return builder as Record<
    (typeof methods)[number] | "then" | "maybeSingle",
    ReturnType<typeof vi.fn>
  > & {
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
          client_id: null,
          lot_code: "LOT-2026-000001",
          created_at: "2026-07-01T10:00:00.000Z",
          items: { title: "Argila reciclata", unit: "kg" },
          // Lot de achizitie -> fara client (doar aportul are, vezi migrarea 0030).
          clients: null,
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
        lotCode: "LOT-2026-000001",
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
        clientId: null,
        clientName: null,
        cancelledAt: null,
        cancelReason: null,
        createdAt: "2026-07-01T10:00:00.000Z",
      },
    ]);
  });

  it("expune clientul care a adus materialul, pentru loturile de aport", async () => {
    const builder = makeQueryBuilder({
      data: [
        {
          id: "lot-aport",
          item_id: "item-1",
          entry_date: "2026-07-02",
          source: "Aport client - Bravo Construct SRL",
          provenance: "aport_client",
          location: null,
          initial_qty: 80,
          remaining_qty: 80,
          quality_status: "unchecked",
          is_blocked: false,
          block_reason: null,
          client_id: "client-1",
          lot_code: "LOT-2026-000002",
          created_at: "2026-07-02T10:00:00.000Z",
          items: { title: "Moloz", unit: "tona" },
          clients: { name: "Bravo Construct SRL" },
        },
      ],
      error: null,
    });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    const [lot] = await listLots();

    expect(lot.clientId).toBe("client-1");
    expect(lot.clientName).toBe("Bravo Construct SRL");
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

describe("getLotById", () => {
  it("mapeaza lotul gasit (ecranul de detaliu /stoc/loturi/[id])", async () => {
    const builder = makeQueryBuilder({
      data: {
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
        client_id: null,
        lot_code: "LOT-2026-000001",
        created_at: "2026-07-01T10:00:00.000Z",
        items: { title: "Argila reciclata", unit: "kg" },
        clients: null,
      },
      error: null,
    });
    const from = vi.fn().mockReturnValue(builder);
    createClient.mockResolvedValue({ from });

    const result = await getLotById("lot-1");

    expect(from).toHaveBeenCalledWith("lots");
    expect(builder.eq).toHaveBeenCalledWith("id", "lot-1");
    expect(result?.lotCode).toBe("LOT-2026-000001");
    expect(result?.itemTitle).toBe("Argila reciclata");
  });

  it("intoarce null cand lotul nu exista (sau nu e accesibil - RLS)", async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    const result = await getLotById("lot-necunoscut");

    expect(result).toBeNull();
  });

  it("arunca eroare cand query-ul esueaza", async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: "db down" } });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await expect(getLotById("lot-1")).rejects.toThrow("Nu am putut incarca lotul.");
  });
});

describe("getLotTraceability", () => {
  it("intoarce procesul care a produs lotul si procesele care l-au consumat", async () => {
    const outputBuilder = makeQueryBuilder({
      data: [
        {
          quantity: 40,
          processes: {
            id: "proc-1",
            type: "output_fixed",
            status: "completed",
            created_at: "2026-07-01T09:00:00.000Z",
          },
        },
      ],
      error: null,
    });
    const inputBuilder = makeQueryBuilder({
      data: [
        {
          quantity: 10,
          processes: {
            id: "proc-2",
            type: "input_fixed",
            status: "in_progress",
            created_at: "2026-07-03T09:00:00.000Z",
          },
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) =>
      table === "process_outputs" ? outputBuilder : inputBuilder,
    );
    createClient.mockResolvedValue({ from });

    const result = await getLotTraceability("lot-1");

    expect(result.producedBy).toEqual({
      processId: "proc-1",
      type: "output_fixed",
      status: "completed",
      quantity: 40,
      createdAt: "2026-07-01T09:00:00.000Z",
    });
    expect(result.consumedBy).toEqual([
      {
        processId: "proc-2",
        type: "input_fixed",
        status: "in_progress",
        quantity: 10,
        createdAt: "2026-07-03T09:00:00.000Z",
      },
    ]);
  });

  it("intoarce liste goale pentru un lot de intrare directa, nefolosit inca", async () => {
    const emptyBuilder = makeQueryBuilder({ data: [], error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(emptyBuilder) });

    const result = await getLotTraceability("lot-1");

    expect(result).toEqual({ producedBy: null, consumedBy: [] });
  });

  it("arunca eroare cand oricare dintre query-uri esueaza", async () => {
    const failingBuilder = makeQueryBuilder({ data: null, error: { message: "db down" } });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(failingBuilder) });

    await expect(getLotTraceability("lot-1")).rejects.toThrow(
      "Nu am putut incarca trasabilitatea lotului.",
    );
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

  it("aplica filtrul de lot (ecranul de detaliu /stoc/loturi/[id])", async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await listStockEvents({ lotId: "lot-1" });

    expect(builder.eq).toHaveBeenCalledWith("lot_id", "lot-1");
  });

  it("arunca eroare cand query-ul esueaza", async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: "db down" } });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await expect(listStockEvents()).rejects.toThrow("Nu am putut incarca jurnalul de stoc.");
  });
});
