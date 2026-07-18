import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies — vezi AGENTS.md §2.2).
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { listItemOptions } = vi.hoisted(() => ({ listItemOptions: vi.fn() }));
vi.mock("@/features/items/queries", () => ({ listItemOptions }));

import { getRecipeByItemId, listPhysicalItemsWithoutRecipe, listRecipes } from "./queries";

/** Query builder Supabase fals: chainable + thenable; `maybeSingle` e terminal. */
function makeQueryBuilder(finalResult: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> & { then: (resolve: (v: unknown) => void) => void } = {
    then: (resolve) => resolve(finalResult),
  };
  for (const m of ["select", "order", "eq"]) {
    builder[m] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("listRecipes", () => {
  it("agrega nr. de componente si suma procentelor per rețetă", async () => {
    const recipesBuilder = makeQueryBuilder({
      data: [
        { id: "recipe-1", item_id: "item-1", items: { title: "Cărămidă eco", unit: "bucata" } },
        { id: "recipe-2", item_id: "item-2", items: { title: "Beton", unit: "mc" } },
      ],
      error: null,
    });
    const componentsBuilder = makeQueryBuilder({
      data: [
        { recipe_id: "recipe-1", percentage: 30 },
        { recipe_id: "recipe-1", percentage: 70 },
      ],
      error: null,
    });
    const from = vi.fn((table: string) =>
      table === "recipes" ? recipesBuilder : componentsBuilder,
    );
    createClient.mockResolvedValue({ from });

    const result = await listRecipes();

    expect(result).toEqual([
      {
        recipeId: "recipe-1",
        itemId: "item-1",
        itemTitle: "Cărămidă eco",
        unit: "bucata",
        componentCount: 2,
        percentageSum: 100,
      },
      {
        recipeId: "recipe-2",
        itemId: "item-2",
        itemTitle: "Beton",
        unit: "mc",
        componentCount: 0,
        percentageSum: 0,
      },
    ]);
  });

  it("arunca eroare cand interogarea retetelor esueaza", async () => {
    const recipesBuilder = makeQueryBuilder({ data: null, error: { message: "db down" } });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(recipesBuilder) });

    await expect(listRecipes()).rejects.toThrow("Nu am putut incarca lista de retete.");
  });
});

describe("getRecipeByItemId", () => {
  it("returneaza null cand itemul nu are inca o rețetă", async () => {
    const recipeBuilder = makeQueryBuilder({ data: null, error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(recipeBuilder) });

    expect(await getRecipeByItemId("item-1")).toBeNull();
  });

  it("mapeaza reteta cu componentele si suma procentelor", async () => {
    const recipeBuilder = makeQueryBuilder({
      data: { id: "recipe-1", item_id: "item-1", items: { title: "Cărămidă eco", unit: "bucata" } },
      error: null,
    });
    const componentsBuilder = makeQueryBuilder({
      data: [
        {
          id: "comp-1",
          component_item_id: "item-2",
          percentage: 40,
          items: { title: "Argilă", unit: "kg" },
        },
      ],
      error: null,
    });
    const from = vi.fn((table: string) =>
      table === "recipes" ? recipeBuilder : componentsBuilder,
    );
    createClient.mockResolvedValue({ from });

    const result = await getRecipeByItemId("item-1");

    expect(componentsBuilder.eq).toHaveBeenCalledWith("recipe_id", "recipe-1");
    expect(result).toEqual({
      recipeId: "recipe-1",
      itemId: "item-1",
      itemTitle: "Cărămidă eco",
      unit: "bucata",
      components: [
        {
          id: "comp-1",
          componentItemId: "item-2",
          componentItemTitle: "Argilă",
          unit: "kg",
          percentage: 40,
        },
      ],
      percentageSum: 40,
    });
  });
});

describe("listPhysicalItemsWithoutRecipe", () => {
  it("exclude itemii fizici care au deja o rețetă", async () => {
    listItemOptions.mockResolvedValue([
      { id: "item-1", title: "Cărămidă eco", unit: "bucata", kind: "physical" },
      { id: "item-2", title: "Beton", unit: "mc", kind: "physical" },
    ]);
    const recipesBuilder = makeQueryBuilder({ data: [{ item_id: "item-1" }], error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(recipesBuilder) });

    const result = await listPhysicalItemsWithoutRecipe();

    expect(listItemOptions).toHaveBeenCalledWith({ kind: "physical" });
    expect(result).toEqual([{ id: "item-2", title: "Beton", unit: "mc" }]);
  });
});
