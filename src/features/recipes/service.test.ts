import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import {
  addOrUpdateComponent,
  createRecipe,
  removeComponent,
  updateRecipeDirection,
} from "./service";

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
    const insert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) });
    const from = vi.fn((table: string) => {
      if (table === "items") {
        return {
          select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
        };
      }
      if (table === "recipes") {
        return { insert, select: vi.fn().mockReturnValue({ single }) };
      }
      throw new Error(`tabel neasteptat in test: ${table}`);
    });
    return { from, insert };
  }

  it("creeaza reteta pentru un item de tip fizic, implicit `compunere`", async () => {
    const { from, insert } = mockSupabase({
      item: { id: "item-1", organization_id: "org-1", kind: "physical" },
      insertResult: { data: { id: "recipe-1", item_id: "item-1" }, error: null },
    });
    createClient.mockResolvedValue({ from });

    const result = await createRecipe("item-1");

    expect(insert).toHaveBeenCalledWith({
      organization_id: "org-1",
      item_id: "item-1",
      direction: "compunere",
    });
    expect(result).toEqual({ id: "recipe-1", itemId: "item-1" });
  });

  it("salveaza directia ceruta (descompunere - reciclare, migrarea 0028)", async () => {
    const { from, insert } = mockSupabase({
      item: { id: "moloz", organization_id: "org-1", kind: "physical" },
      insertResult: { data: { id: "recipe-2", item_id: "moloz" }, error: null },
    });
    createClient.mockResolvedValue({ from });

    await createRecipe("moloz", "descompunere");

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ direction: "descompunere" }));
  });

  it("respinge itemi de tip serviciu", async () => {
    const { from } = mockSupabase({
      item: { id: "item-1", organization_id: "org-1", kind: "service" },
    });
    createClient.mockResolvedValue({ from });

    await expect(createRecipe("item-1")).rejects.toThrow(/nu pentru servicii/i);
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
        // Implicit 1 cand apelantul nu trimite nimic (migrarea 0028).
        conversion_factor: 1,
      },
      { onConflict: "recipe_id,component_item_id" },
    );
  });

  it("salveaza factorul de conversie primit", async () => {
    const { from, upsert } = mockSupabase({
      recipe: { id: "recipe-1", item_id: "item-1", organization_id: "org-1" },
    });
    createClient.mockResolvedValue({ from });

    await addOrUpdateComponent({
      recipeId: "recipe-1",
      componentItemId: "item-2",
      percentage: 30,
      conversionFactor: 1500,
    });

    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ conversion_factor: 1500 }), {
      onConflict: "recipe_id,component_item_id",
    });
  });

  it("respinge un factor de conversie <= 0 fara sa interogheze DB", async () => {
    const { from } = mockSupabase();
    createClient.mockResolvedValue({ from });

    await expect(
      addOrUpdateComponent({
        recipeId: "recipe-1",
        componentItemId: "item-2",
        percentage: 40,
        conversionFactor: 0,
      }),
    ).rejects.toThrow(/factor/i);
    expect(from).not.toHaveBeenCalled();
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

describe("updateRecipeDirection", () => {
  it("actualizeaza directia retetei dupa id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    createClient.mockResolvedValue({ from });

    await updateRecipeDirection("recipe-1", "descompunere");

    expect(from).toHaveBeenCalledWith("recipes");
    expect(update).toHaveBeenCalledWith({ direction: "descompunere" });
    expect(eq).toHaveBeenCalledWith("id", "recipe-1");
  });

  it("arunca eroare cand actualizarea esueaza", async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const from = vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue({ eq }) });
    createClient.mockResolvedValue({ from });

    await expect(updateRecipeDirection("recipe-1", "compunere")).rejects.toThrow("boom");
  });
});
