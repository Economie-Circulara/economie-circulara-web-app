import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { getProcessById, listProcesses } from "./queries";

/**
 * Query builder Supabase fals: chainable (select/order/eq intorc `this`) si
 * "thenable" / suporta `maybeSingle()` care rezolva direct rezultatul final —
 * la fel ca PostgrestFilterBuilder-ul real. (Pattern reluat din
 * src/features/stock/queries.test.ts.)
 */
function makeQueryBuilder(finalResult: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> & { then: (resolve: (v: unknown) => void) => void } = {
    then: (resolve) => resolve(finalResult),
  };
  builder.select = vi.fn(() => builder);
  builder.order = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("listProcesses", () => {
  it("mapeaza randurile (inclusiv itemul de output imbricat)", async () => {
    const builder = makeQueryBuilder({
      data: [
        {
          id: "proc-1",
          type: "output_fixed",
          status: "completed",
          output_item_id: "item-out",
          recipe_id: "recipe-1",
          started_at: "2026-07-01T10:00:00.000Z",
          completed_at: "2026-07-01T10:05:00.000Z",
          created_at: "2026-07-01T10:00:00.000Z",
          items: { title: "Cărămidă eco" },
        },
      ],
      error: null,
    });
    const from = vi.fn().mockReturnValue(builder);
    createClient.mockResolvedValue({ from });

    const result = await listProcesses();

    expect(from).toHaveBeenCalledWith("processes");
    expect(result).toEqual([
      {
        id: "proc-1",
        type: "output_fixed",
        status: "completed",
        outputItemId: "item-out",
        outputItemTitle: "Cărămidă eco",
        recipeId: "recipe-1",
        startedAt: "2026-07-01T10:00:00.000Z",
        completedAt: "2026-07-01T10:05:00.000Z",
        createdAt: "2026-07-01T10:00:00.000Z",
      },
    ]);
  });

  it("arunca eroare cand interogarea esueaza", async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: "boom" } });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await expect(listProcesses()).rejects.toThrow("istoricul proceselor");
  });
});

describe("getProcessById", () => {
  function mockTables({
    process,
    inputs = [],
    outputs = [],
  }: {
    process: Record<string, unknown> | null;
    inputs?: Record<string, unknown>[];
    outputs?: Record<string, unknown>[];
  }) {
    const from = vi.fn((table: string) => {
      if (table === "processes") {
        return makeQueryBuilder({ data: process, error: null });
      }
      if (table === "process_inputs") {
        return makeQueryBuilder({ data: inputs, error: null });
      }
      if (table === "process_outputs") {
        return makeQueryBuilder({ data: outputs, error: null });
      }
      throw new Error(`tabel neasteptat in test: ${table}`);
    });
    createClient.mockResolvedValue({ from });
    return from;
  }

  it("returneaza null cand procesul nu exista/nu e accesibil", async () => {
    mockTables({ process: null });
    expect(await getProcessById("proc-x")).toBeNull();
  });

  it("mapeaza procesul + input/output loturi + totalurile calculate (pt. randament/pierderi)", async () => {
    mockTables({
      process: {
        id: "proc-1",
        type: "input_fixed",
        status: "completed",
        output_item_id: "item-out",
        recipe_id: "recipe-1",
        notes: null,
        started_at: "2026-07-01T10:00:00.000Z",
        completed_at: "2026-07-01T10:05:00.000Z",
        created_at: "2026-07-01T10:00:00.000Z",
        items: { title: "Moloz beton" },
      },
      inputs: [
        {
          lot_id: "lot-in",
          item_id: "item-in",
          quantity: 500,
          items: { title: "Moloz beton", unit: "kg" },
          lots: { provenance: "purchase" },
        },
      ],
      outputs: [
        {
          lot_id: "lot-out-1",
          item_id: "item-out-1",
          quantity: 250,
          items: { title: "Nisip reciclat", unit: "kg" },
          lots: { provenance: "recycling" },
        },
        {
          lot_id: "lot-out-2",
          item_id: "item-out-2",
          quantity: 200,
          items: { title: "Pietriș", unit: "kg" },
          lots: { provenance: "recycling" },
        },
      ],
    });

    const result = await getProcessById("proc-1");

    expect(result?.outputItemTitle).toBe("Moloz beton");
    expect(result?.inputs).toEqual([
      {
        lotId: "lot-in",
        itemId: "item-in",
        itemTitle: "Moloz beton",
        unit: "kg",
        quantity: 500,
        provenance: "purchase",
      },
    ]);
    expect(result?.outputs).toHaveLength(2);
    expect(result?.totalInputQty).toBe(500);
    expect(result?.totalOutputQty).toBe(450);
  });
});
