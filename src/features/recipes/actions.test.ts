import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { createRecipe, addOrUpdateComponent, removeComponent } = vi.hoisted(() => ({
  createRecipe: vi.fn(),
  addOrUpdateComponent: vi.fn(),
  removeComponent: vi.fn(),
}));
vi.mock("./service", () => ({ createRecipe, addOrUpdateComponent, removeComponent }));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { addComponentAction, createRecipeAction, removeComponentAction } from "./actions";
import { initialRecipeFormState } from "./form-state";

afterEach(() => {
  vi.clearAllMocks();
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createRecipeAction", () => {
  it("cere un item", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await createRecipeAction(initialRecipeFormState, formData({}));
    expect(state.error).toMatch(/item/i);
    expect(createRecipe).not.toHaveBeenCalled();
  });

  it("creeaza reteta si redirectioneaza la editor", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    createRecipe.mockResolvedValue({ id: "recipe-1", itemId: "item-1" });

    await expect(
      createRecipeAction(initialRecipeFormState, formData({ item_id: "item-1" })),
    ).rejects.toThrow("REDIRECT:/retete/item-1");

    expect(createRecipe).toHaveBeenCalledWith("item-1");
    expect(revalidatePath).toHaveBeenCalledWith("/retete");
  });

  it("propaga eroarea serviciului (ex. item de tip serviciu)", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    createRecipe.mockRejectedValue(
      new Error("Rețetele se pot defini doar pentru itemi de tip fizic."),
    );

    const state = await createRecipeAction(initialRecipeFormState, formData({ item_id: "item-1" }));

    expect(state.error).toBe("Rețetele se pot defini doar pentru itemi de tip fizic.");
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("addComponentAction", () => {
  it("respinge cererea fara componentă aleasă", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await addComponentAction(
      initialRecipeFormState,
      formData({ recipe_id: "recipe-1", item_id: "item-1", percentage: "40" }),
    );
    expect(state.error).toMatch(/componentă/i);
    expect(addOrUpdateComponent).not.toHaveBeenCalled();
  });

  it("respinge un procent necompletat", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await addComponentAction(
      initialRecipeFormState,
      formData({ recipe_id: "recipe-1", item_id: "item-1", component_item_id: "item-2" }),
    );
    expect(state.error).toMatch(/procent/i);
    expect(addOrUpdateComponent).not.toHaveBeenCalled();
  });

  it("adauga componenta si revalideaza editorul + lista", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    addOrUpdateComponent.mockResolvedValue(undefined);

    const state = await addComponentAction(
      initialRecipeFormState,
      formData({
        recipe_id: "recipe-1",
        item_id: "item-1",
        component_item_id: "item-2",
        percentage: "33,5",
      }),
    );

    expect(addOrUpdateComponent).toHaveBeenCalledWith({
      recipeId: "recipe-1",
      componentItemId: "item-2",
      percentage: 33.5,
    });
    expect(state.error).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/retete/item-1");
    expect(revalidatePath).toHaveBeenCalledWith("/retete");
  });

  it("propaga eroarea serviciului (ex. auto-referinta)", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    addOrUpdateComponent.mockRejectedValue(
      new Error("Un item nu poate fi componenta propriei rețete."),
    );

    const state = await addComponentAction(
      initialRecipeFormState,
      formData({
        recipe_id: "recipe-1",
        item_id: "item-1",
        component_item_id: "item-1",
        percentage: "10",
      }),
    );

    expect(state.error).toBe("Un item nu poate fi componenta propriei rețete.");
  });
});

describe("removeComponentAction", () => {
  it("cere o componentă valida", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await removeComponentAction(initialRecipeFormState, formData({}));
    expect(state.error).toMatch(/componentă/i);
    expect(removeComponent).not.toHaveBeenCalled();
  });

  it("sterge componenta si revalideaza", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    removeComponent.mockResolvedValue(undefined);

    const state = await removeComponentAction(
      initialRecipeFormState,
      formData({ component_id: "comp-1", item_id: "item-1" }),
    );

    expect(removeComponent).toHaveBeenCalledWith("comp-1");
    expect(state.error).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/retete/item-1");
  });
});
