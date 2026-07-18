import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies — vezi AGENTS.md §2.2): inlocuim complet clientul Supabase server.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { listCatalogItems } from "./queries";

/**
 * Query builder Supabase fals: chainable ("thenable"), acelasi stil ca
 * `src/features/items/queries.test.ts#makeQueryBuilder`.
 */
function makeQueryBuilder(finalResult: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> & { then: (resolve: (v: unknown) => void) => void } = {
    then: (resolve) => resolve(finalResult),
  };
  for (const m of ["select", "order", "eq", "ilike"]) {
    builder[m] = vi.fn(() => builder);
  }
  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

function itemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    title: "Cărămidă eco",
    description: "Cărămidă din materiale reciclate",
    unit: "bucata",
    kind: "physical",
    image_url: null,
    ...overrides,
  };
}

describe("listCatalogItems", () => {
  it("filtreaza mereu dupa sellable=true (gating pret/stoc — catalogul clientului)", async () => {
    const builder = makeQueryBuilder({ data: [itemRow()], error: null });
    const from = vi.fn().mockReturnValue(builder);
    createClient.mockResolvedValue({ from });

    await listCatalogItems();

    expect(from).toHaveBeenCalledWith("items");
    expect(builder.select).toHaveBeenCalledWith("id, title, description, unit, kind, image_url");
    expect(builder.eq).toHaveBeenCalledWith("sellable", true);
  });

  it("mapeaza randurile in CatalogItem (fara camp de pret/stoc)", async () => {
    const builder = makeQueryBuilder({ data: [itemRow()], error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    const result = await listCatalogItems();

    expect(result).toEqual([
      {
        id: "item-1",
        title: "Cărămidă eco",
        description: "Cărămidă din materiale reciclate",
        unit: "bucata",
        kind: "physical",
        imageUrl: null,
      },
    ]);
    expect(result[0]).not.toHaveProperty("price");
    expect(result[0]).not.toHaveProperty("stock");
  });

  it("aplica filtrul de tip si cautare", async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await listCatalogItems({ kind: "service", search: "eco" });

    expect(builder.eq).toHaveBeenCalledWith("kind", "service");
    expect(builder.ilike).toHaveBeenCalledWith("title", "%eco%");
  });

  it("arunca eroare cand interogarea esueaza", async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: "db down" } });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await expect(listCatalogItems()).rejects.toThrow("Nu am putut încărca catalogul.");
  });
});
