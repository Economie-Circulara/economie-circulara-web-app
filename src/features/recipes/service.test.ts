import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { addOrUpdateComponent, createRecipe, removeComponent } from "./service";

afterEach(() => {
  vi.clearAllMocks();
});

describe("createRecipe", () => {
  function mockSupabase({
    item,
    insertResult,
  }: {
    item?: Record<string, unknown> | null;
    insertResult?: { data: unknown; error: unknown };
  } = {}) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: item ?? null, error: null });
    const single = vi.fn().mockResolvedValue(insertResult ?? { data: null, error: null });
    const from = vi.fn((table: string) => {
      if (table === "items") {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
        };
      }
      if (table === "recipes") {
        return { insert: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }) };
      }
      throw new Error(`tabel neasteptat in test: ${table}`);
    });
    return { from };
  }

  it("creeaza reteta pentru un item de tip fizic", async () => {
    const { from } = mockSupabase({
      item: { id: "item-1", organization_id: "org-1", kind: "physical" },
      insertResult: { data: { id: "recipe-1", item_id: "item-1" }, error: null },
    });
    createClient.mockResolvedValue({ from });

    const result = await createRecipe("item-1");

    expect(result).toEqual({ id: "recipe-1", itemId: "item-1" });
  });

  it("respinge itemi de tip serviciu", async () => {
    const { from } = mockSupabase({
      item: { id: "item-1", organization_id: "org-1", kind: "service" },
    });
    createClient.mockResolvedValue({ from });

    await expect(createRecipe("item-1")).rejects.toThrow(/tip fizic/i);
  });

  it("arunca eroare cand itemul nu exista sau nu e accesibil", async () => {
    const { from } = mockSupabase({ item: null });
    createClient.mockResolvedValue({ from });

    await expect(createRecipe("item-x")).rejects.toThrow(/inexistent/i);
  });
});

describe("addOrUpdateComponent", () => {
  function mockSupabase({
    recipe,
    upsertError,
  }: {
    recipe?: Record<string, unknown> | null;
    upsertError?: { message: string } | null;
  } = {}) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: recipe ?? null, error: null });
    const upsert = vi.fn().mockResolvedValue({ error: upsertError ?? null });
    const from = vi.fn((table: string) => {
      if (table === "recipes") {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
        };
      }
      if (table === "recipe_components") {
        return { upsert };
      }
      throw new Error(`tabel neasteptat in test: ${table}`);
    });
    return { from, upsert };
  }

  it("respinge un procent invalid fara sa interogheze DB", async () => {
    const { from } = mockSupabase();
    createClient.mockResolvedValue({ from });

    await expect(
      addOrUpdateComponent({ recipeId: "recipe-1", componentItemId: "item-2", percentage: 0 }),
    ).rejects.toThrow(/mai mare/i);
    expect(from).not.toHaveBeenCalled();
  });

  it("respinge auto-referinta (componenta = itemul propriu al retetei)", async () => {
    const { from } = mockSupabase({
      recipe: { id: "recipe-1", item_id: "item-1", organization_id: "org-1" },
    });
    createClient.mockResolvedValue({ from });

    await expect(
      addOrUpdateComponent({ recipeId: "recipe-1", componentItemId: "item-1", percentage: 50 }),
    ).rejects.toThrow(/propriei rețete/i);
  });

  it("face upsert cu organization_id preluat din rețetă (nu din input extern)", async () => {
    const { from, upsert } = mockSupabase({
      recipe: { id: "recipe-1", item_id: "item-1", organization_id: "org-1" },
    });
    createClient.mockResolvedValue({ from });

    await addOrUpdateComponent({ recipeId: "recipe-1", componentItemId: "item-2", percentage: 40 });

    expect(upsert).toHaveBeenCalledWith(
      {
        organization_id: "org-1",
        recipe_id: "recipe-1",
        component_item_id: "item-2",
        percentage: 40,
      },
      { onConflict: "recipe_id,component_item_id" },
    );
  });

  it("arunca eroare cand reteta nu exista sau nu e accesibila", async () => {
    const { from } = mockSupabase({ recipe: null });
    createClient.mockResolvedValue({ from });

    await expect(
      addOrUpdateComponent({ recipeId: "recipe-x", componentItemId: "item-2", percentage: 40 }),
    ).rejects.toThrow(/inexistentă/i);
  });
});

describe("removeComponent", () => {
  it("sterge componenta dupa id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ delete: del });
    createClient.mockResolvedValue({ from });

    await removeComponent("comp-1");

    expect(from).toHaveBeenCalledWith("recipe_components");
    expect(eq).toHaveBeenCalledWith("id", "comp-1");
  });

  it("arunca eroare cand stergerea esueaza", async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const from = vi.fn().mockReturnValue({ delete: vi.fn().mockReturnValue({ eq }) });
    createClient.mockResolvedValue({ from });

    await expect(removeComponent("comp-1")).rejects.toThrow("boom");
  });
});
