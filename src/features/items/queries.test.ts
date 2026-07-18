import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies — vezi AGENTS.md §2.2): inlocuim complet clientul Supabase server.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { getItemById, listItemOptions, listItems } from "./queries";

/**
 * Query builder Supabase fals: chainable (select/order/eq/ilike/neq intorc `this`,
 * "thenable" ca PostgrestFilterBuilder), `maybeSingle` e terminal (rezolva direct).
 */
function makeQueryBuilder(finalResult: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> & { then: (resolve: (v: unknown) => void) => void } = {
    then: (resolve) => resolve(finalResult),
  };
  for (const m of ["select", "order", "eq", "ilike", "neq"]) {
    builder[m] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("listItems", () => {
  function itemsRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "item-1",
      title: "Cărămidă eco",
      description: "Descriere",
      unit: "bucata",
      kind: "physical",
      sellable: true,
      image_url: null,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("mapeaza itemii si marcheaza hasRecipe pe baza tabelei recipes", async () => {
    const itemsBuilder = makeQueryBuilder({
      data: [itemsRow({ id: "item-1" }), itemsRow({ id: "item-2", title: "Nisip reciclat" })],
      error: null,
    });
    const recipesBuilder = makeQueryBuilder({ data: [{ item_id: "item-1" }], error: null });
    const from = vi.fn((table: string) => (table === "items" ? itemsBuilder : recipesBuilder));
    createClient.mockResolvedValue({ from });

    const result = await listItems();

    expect(from).toHaveBeenCalledWith("items");
    expect(from).toHaveBeenCalledWith("recipes");
    expect(result).toEqual([
      expect.objectContaining({ id: "item-1", hasRecipe: true }),
      expect.objectContaining({ id: "item-2", hasRecipe: false }),
    ]);
  });

  it("aplica filtrele de tip, vandabil si cautare", async () => {
    const itemsBuilder = makeQueryBuilder({ data: [], error: null });
    const recipesBuilder = makeQueryBuilder({ data: [], error: null });
    createClient.mockResolvedValue({
      from: vi.fn((table: string) => (table === "items" ? itemsBuilder : recipesBuilder)),
    });

    await listItems({ kind: "service", sellable: true, search: "eco" });

    expect(itemsBuilder.eq).toHaveBeenCalledWith("kind", "service");
    expect(itemsBuilder.eq).toHaveBeenCalledWith("sellable", true);
    expect(itemsBuilder.ilike).toHaveBeenCalledWith("title", "%eco%");
  });

  it("arunca eroare cand query-ul de itemi esueaza", async () => {
    const itemsBuilder = makeQueryBuilder({ data: null, error: { message: "db down" } });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(itemsBuilder) });

    await expect(listItems()).rejects.toThrow("Nu am putut incarca lista de itemi.");
  });
});

describe("getItemById", () => {
  it("returneaza itemul mapat cand exista", async () => {
    const builder = makeQueryBuilder({
      data: {
        id: "item-1",
        title: "Ciment",
        description: null,
        unit: "kg",
        kind: "physical",
        sellable: false,
        image_url: null,
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
      },
      error: null,
    });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    const result = await getItemById("item-1");

    expect(builder.eq).toHaveBeenCalledWith("id", "item-1");
    expect(result?.title).toBe("Ciment");
  });

  it("returneaza null cand itemul nu exista/nu e accesibil", async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    expect(await getItemById("item-x")).toBeNull();
  });
});

describe("listItemOptions", () => {
  it("mapeaza optiunile ordonate dupa titlu", async () => {
    const builder = makeQueryBuilder({
      data: [{ id: "item-1", title: "Ciment", unit: "kg", kind: "physical" }],
      error: null,
    });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    const result = await listItemOptions();

    expect(result).toEqual([{ id: "item-1", title: "Ciment", unit: "kg", kind: "physical" }]);
    expect(builder.order).toHaveBeenCalledWith("title");
  });

  it("aplica filtrul de tip si excluderea unui item", async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await listItemOptions({ kind: "physical", excludeId: "item-1" });

    expect(builder.eq).toHaveBeenCalledWith("kind", "physical");
    expect(builder.neq).toHaveBeenCalledWith("id", "item-1");
  });
});
