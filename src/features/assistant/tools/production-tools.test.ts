import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "../types";

vi.mock("@/features/items/queries", () => ({
  getItemById: vi
    .fn()
    .mockResolvedValue({ id: "beton", title: "Beton", unit: "kg", kind: "physical" }),
  listItemOptions: vi
    .fn()
    .mockResolvedValue([
      { id: "nisip", title: "Nisip", unit: "kg", kind: "physical", isTracked: true },
    ]),
}));
vi.mock("@/features/recipes/queries", () => ({ getRecipeByItemId: vi.fn() }));
vi.mock("@/features/recipes/service", () => ({
  createRecipe: vi.fn().mockResolvedValue({ id: "r-new", itemId: "beton" }),
  addOrUpdateComponents: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/stock/queries", () => ({ listLots: vi.fn() }));
vi.mock("@/features/production/service", () => ({ confirmProcess: vi.fn() }));

const { getRecipeByItemId } = await import("@/features/recipes/queries");
const recipeService = await import("@/features/recipes/service");
const { listLots } = await import("@/features/stock/queries");
const { confirmProcess } = await import("@/features/production/service");
const { creeazaReteta, pornesteProductie, retetaProdus } = await import("./production-tools");
const { InvalidToolArgumentsError } = await import("./types");

const CTX: ToolContext = { userId: "u1", role: "admin", organizationId: "org-1", clientId: null };

function recipe(overrides: Record<string, unknown> = {}) {
  return {
    recipeId: "r1",
    itemId: "beton",
    itemTitle: "Beton",
    unit: "kg",
    direction: "compunere",
    archivedAt: null,
    recipeArchivedAt: null,
    percentageSum: 100,
    components: [
      {
        id: "rc1",
        componentItemId: "nisip",
        componentItemTitle: "Nisip",
        unit: "kg",
        percentage: 80,
        conversionFactor: 1,
        isTracked: true,
      },
      {
        id: "rc2",
        componentItemId: "apa",
        componentItemTitle: "Apă",
        unit: "litru",
        percentage: 20,
        conversionFactor: 1,
        isTracked: false,
      },
    ],
    ...overrides,
  } as never;
}

function lot(id: string, remainingQty: number, entryDate: string) {
  return { id, remainingQty, entryDate, isBlocked: false };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("reteta_produs", () => {
  it("null pentru o reteta arhivata", async () => {
    vi.mocked(getRecipeByItemId).mockResolvedValue(recipe({ archivedAt: "2026-01-01" }));
    expect(await retetaProdus.execute({ item_id: "beton" }, CTX)).toBeNull();
  });

  it("intoarce metoda si componentele cu item_id", async () => {
    vi.mocked(getRecipeByItemId).mockResolvedValue(recipe());
    const result = (await retetaProdus.execute({ item_id: "beton" }, CTX)) as {
      metoda: string;
      componente: { item_id: string; nelimitat: boolean }[];
    };
    expect(result.metoda).toBe("compunere");
    expect(result.componente.map((row) => [row.item_id, row.nelimitat])).toEqual([
      ["nisip", false],
      ["apa", true],
    ]);
  });
});

describe("creeaza_reteta", () => {
  const args = {
    item_id: "beton",
    directie: "compunere",
    componente: [{ item_id: "nisip", procent: 80 }],
  };

  it("refuza auto-referinta, duplicatele si directia necunoscuta", () => {
    expect(() =>
      creeazaReteta.parse({ ...args, componente: [{ item_id: "beton", procent: 10 }] }),
    ).toThrow(InvalidToolArgumentsError);
    expect(() =>
      creeazaReteta.parse({
        ...args,
        componente: [
          { item_id: "nisip", procent: 10 },
          { item_id: "nisip", procent: 20 },
        ],
      }),
    ).toThrow(/de două ori/);
    expect(() => creeazaReteta.parse({ ...args, directie: "amestec" })).toThrow(
      InvalidToolArgumentsError,
    );
  });

  it("cardul dedicat `recipe_draft` cu optiunile de materiale", async () => {
    const card = await creeazaReteta.presentation!(creeazaReteta.parse(args), CTX);
    expect(card).toMatchObject({
      renderer: "recipe_draft",
      itemTitle: "Beton",
      draft: { direction: "compunere", components: [{ itemId: "nisip", percentage: 80 }] },
      componentOptions: [{ id: "nisip", title: "Nisip", unit: "kg" }],
    });
  });

  it("creeaza reteta si componentele; refuza daca produsul are deja reteta", async () => {
    vi.mocked(getRecipeByItemId).mockResolvedValueOnce(null);
    await creeazaReteta.execute(creeazaReteta.parse(args), CTX);
    expect(recipeService.createRecipe).toHaveBeenCalledWith("beton", "compunere");
    expect(recipeService.addOrUpdateComponents).toHaveBeenCalledWith("r-new", [
      { componentItemId: "nisip", percentage: 80 },
    ]);

    vi.mocked(getRecipeByItemId).mockResolvedValueOnce(recipe());
    await expect(creeazaReteta.execute(creeazaReteta.parse(args), CTX)).rejects.toThrow(
      /are deja o rețetă/,
    );
    expect(recipeService.createRecipe).toHaveBeenCalledTimes(1);
  });
});

describe("porneste_productie", () => {
  it("consum din reteta + FIFO pe loturile cele mai vechi; itemii nelimitati fara loturi", async () => {
    vi.mocked(getRecipeByItemId).mockResolvedValue(recipe());
    vi.mocked(listLots).mockResolvedValue([
      lot("nou", 1000, "2026-09-01"),
      lot("vechi", 500, "2026-01-01"),
    ] as never);
    vi.mocked(confirmProcess).mockResolvedValue({ id: "p1" } as never);

    const result = await pornesteProductie.execute(
      pornesteProductie.parse({ item_id: "beton", cantitate: 1000, tip: "reciclare" }),
      CTX,
    );

    expect(listLots).toHaveBeenCalledTimes(1);
    expect(confirmProcess).toHaveBeenCalledWith({
      type: "output_fixed",
      outputItemId: "beton",
      recipeId: "r1",
      notes: null,
      inputs: [
        { itemId: "nisip", lotIds: ["vechi", "nou"], qty: 800 },
        { itemId: "apa", lotIds: [], qty: 200 },
      ],
      outputs: [{ itemId: "beton", qty: 1000, provenance: "recycling" }],
    });
    expect(result).toMatchObject({ proces_id: "p1", link: "/productie/p1" });
  });

  it("stoc insuficient: nu porneste procesul, eroarea spune ce lipseste", async () => {
    vi.mocked(getRecipeByItemId).mockResolvedValue(recipe());
    vi.mocked(listLots).mockResolvedValue([lot("l1", 100, "2026-01-01")] as never);

    await expect(
      pornesteProductie.execute(
        pornesteProductie.parse({ item_id: "beton", cantitate: 1000 }),
        CTX,
      ),
    ).rejects.toThrow(/Nisip: stoc insuficient: disponibil 100, necesar 800/);
    expect(confirmProcess).not.toHaveBeenCalled();
  });

  it("refuza retetele de descompunere si trimite la wizard", async () => {
    vi.mocked(getRecipeByItemId).mockResolvedValue(recipe({ direction: "descompunere" }));
    await expect(
      pornesteProductie.execute(pornesteProductie.parse({ item_id: "beton", cantitate: 10 }), CTX),
    ).rejects.toThrow(/productie\/nou/);
  });

  it("cardul arata consumul calculat, fara sa arunce la stoc insuficient", async () => {
    vi.mocked(getRecipeByItemId).mockResolvedValue(recipe());
    vi.mocked(listLots).mockResolvedValue([] as never);
    const card = await pornesteProductie.presentation!(
      pornesteProductie.parse({ item_id: "beton", cantitate: 1000 }),
      CTX,
    );
    const text = JSON.stringify(card);
    expect(text).toContain("Nisip: 800 kg - stoc insuficient");
    expect(text).toContain("Apă: 200 litru (nelimitat)");
  });

  it("tip implicit `productie`; tip necunoscut refuzat", () => {
    expect(pornesteProductie.parse({ item_id: "b", cantitate: 1 }).tip).toBe("productie");
    expect(() => pornesteProductie.parse({ item_id: "b", cantitate: 1, tip: "x" })).toThrow(
      InvalidToolArgumentsError,
    );
  });
});
