import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies - AGENTS.md §2.2) - arhivarea retetelor (migrarea 0035).
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { archiveRecipeAction, restoreRecipeAction } from "./actions";
import { effectiveRecipeArchivedAt, listRecipes } from "./queries";
import { setRecipeArchived } from "./service";

function makeBuilder(finalResult: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (v: unknown) => void) => void;
  } = { then: (resolve: (v: unknown) => void) => resolve(finalResult) } as never;
  for (const m of ["select", "order", "eq", "is", "update"]) {
    builder[m] = vi.fn(() => builder);
  }
  builder.maybeSingle = vi.fn().mockResolvedValue(finalResult);
  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

function recipeRow(id: string, archivedAt: string | null, itemArchivedAt: string | null) {
  return {
    id,
    item_id: `item-${id}`,
    direction: "compunere",
    archived_at: archivedAt,
    items: { title: `Item ${id}`, unit: "kg", archived_at: itemArchivedAt },
  };
}

describe("effectiveRecipeArchivedAt", () => {
  it("reteta e 'arhivata' daca ea SAU itemul ei e arhivat", () => {
    expect(effectiveRecipeArchivedAt(null, null)).toBeNull();
    expect(effectiveRecipeArchivedAt("r", null)).toBe("r");
    expect(effectiveRecipeArchivedAt(null, "i")).toBe("i");
    expect(effectiveRecipeArchivedAt(undefined, undefined)).toBeNull();
  });
});

describe("listRecipes - arhivate", () => {
  function setup() {
    const recipes = makeBuilder({
      data: [
        recipeRow("1", null, null),
        recipeRow("2", "2026-09-01T00:00:00.000Z", null),
        recipeRow("3", null, "2026-09-02T00:00:00.000Z"),
      ],
      error: null,
    });
    const components = makeBuilder({ data: [], error: null });
    createClient.mockResolvedValue({
      from: vi.fn((t: string) => (t === "recipes" ? recipes : components)),
    });
  }

  it("implicit (productie, lista) doar retetele active - nici cele cu itemul arhivat", async () => {
    setup();
    const result = await listRecipes();
    expect(result.map((r) => r.recipeId)).toEqual(["1"]);
  });

  it("cu includeArchived le arata pe toate, marcate", async () => {
    setup();
    const result = await listRecipes({ includeArchived: true });
    expect(result.map((r) => [r.recipeId, r.archivedAt])).toEqual([
      ["1", null],
      ["2", "2026-09-01T00:00:00.000Z"],
      ["3", "2026-09-02T00:00:00.000Z"],
    ]);
  });
});

describe("setRecipeArchived", () => {
  it("arhiveaza/restaureaza prin archived_at pe recipes", async () => {
    const builder = makeBuilder({ data: { id: "r1" }, error: null });
    const from = vi.fn().mockReturnValue(builder);
    createClient.mockResolvedValue({ from });

    await setRecipeArchived("r1", false);

    expect(from).toHaveBeenCalledWith("recipes");
    expect(builder.update).toHaveBeenCalledWith({ archived_at: null });
  });

  it("0 randuri afectate => eroare", async () => {
    createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue(makeBuilder({ data: null, error: null })),
    });
    await expect(setRecipeArchived("r-x", true)).rejects.toThrow(/nu există|nu ai acces/i);
  });
});

describe("archiveRecipeAction / restoreRecipeAction", () => {
  it("doar staff; revalideaza lista si editorul retetei", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "operator" });
    createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue(makeBuilder({ data: { id: "r1" }, error: null })),
    });

    expect(await archiveRecipeAction("r1", "item-1")).toEqual({ error: null });
    expect(requireRole).toHaveBeenCalledWith(["admin", "operator"]);
    expect(revalidatePath).toHaveBeenCalledWith("/retete");
    expect(revalidatePath).toHaveBeenCalledWith("/retete/item-1");
  });

  it("intoarce eroarea (nu arunca)", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "admin" });
    createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue(makeBuilder({ data: null, error: { message: "boom" } })),
    });

    const result = await restoreRecipeAction("r1", "item-1");
    expect(result.error).toBe("boom");
  });
});
