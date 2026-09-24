import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const {
  createRecipe,
  addOrUpdateComponent,
  addOrUpdateComponents,
  removeComponent,
  updateRecipeDirection,
} = vi.hoisted(() => ({
  createRecipe: vi.fn(),
  addOrUpdateComponent: vi.fn(),
  addOrUpdateComponents: vi.fn(),
  removeComponent: vi.fn(),
  updateRecipeDirection: vi.fn(),
}));
vi.mock("./service", () => ({
  createRecipe,
  addOrUpdateComponent,
  addOrUpdateComponents,
  removeComponent,
  updateRecipeDirection,
}));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  addComponentAction,
  createRecipeAction,
  removeComponentAction,
  saveQuantityComponentsAction,
  updateRecipeDirectionAction,
} from "./actions";
import { initialRecipeFormState } from "./action-state";

afterEach(() => {
  vi.clearAllMocks();
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createRecipeAction", () => {
  it("cere un material", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await createRecipeAction(initialRecipeFormState, formData({}));
    expect(state.error).toMatch(/material/i);
    expect(createRecipe).not.toHaveBeenCalled();
  });

  it("cere o directie valida (migrarea 0028)", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await createRecipeAction(
      initialRecipeFormState,
      formData({ item_id: "item-1", direction: "altceva" }),
    );
    expect(state.error).toMatch(/direc/i);
    expect(createRecipe).not.toHaveBeenCalled();
  });

  it("creeaza reteta si redirectioneaza la editor", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    createRecipe.mockResolvedValue({ id: "recipe-1", itemId: "item-1" });

    await expect(
      createRecipeAction(
        initialRecipeFormState,
        formData({ item_id: "item-1", direction: "compunere" }),
      ),
    ).rejects.toThrow("REDIRECT:/retete/item-1");

    expect(createRecipe).toHaveBeenCalledWith("item-1", "compunere");
    expect(revalidatePath).toHaveBeenCalledWith("/retete");
  });

  it("transmite directia de descompunere (reciclare) catre serviciu", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    createRecipe.mockResolvedValue({ id: "recipe-2", itemId: "moloz" });

    await expect(
      createRecipeAction(
        initialRecipeFormState,
        formData({ item_id: "moloz", direction: "descompunere" }),
      ),
    ).rejects.toThrow("REDIRECT:/retete/moloz");

    expect(createRecipe).toHaveBeenCalledWith("moloz", "descompunere");
  });

  it("propaga eroarea serviciului (ex. item de tip serviciu)", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    createRecipe.mockRejectedValue(
      new Error("Rețetele se pot defini doar pentru produse, nu pentru servicii."),
    );

    const state = await createRecipeAction(
      initialRecipeFormState,
      formData({ item_id: "item-1", direction: "compunere" }),
    );

    expect(state.error).toBe("Rețetele se pot defini doar pentru produse, nu pentru servicii.");
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("updateRecipeDirectionAction", () => {
  it("respinge o directie necunoscuta", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await updateRecipeDirectionAction(
      initialRecipeFormState,
      formData({ recipe_id: "recipe-1", item_id: "item-1", direction: "invers" }),
    );
    expect(state.error).toMatch(/direc/i);
    expect(updateRecipeDirection).not.toHaveBeenCalled();
  });

  it("schimba directia si revalideaza editorul, lista si wizard-ul de productie", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    updateRecipeDirection.mockResolvedValue(undefined);

    const state = await updateRecipeDirectionAction(
      initialRecipeFormState,
      formData({ recipe_id: "recipe-1", item_id: "item-1", direction: "descompunere" }),
    );

    expect(updateRecipeDirection).toHaveBeenCalledWith("recipe-1", "descompunere");
    expect(state.error).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/retete/item-1");
    expect(revalidatePath).toHaveBeenCalledWith("/productie/nou");
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
      // Camp necompletat in formular => 1 (UM-uri identice, migrarea 0028).
      conversionFactor: 1,
    });
    expect(state.error).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/retete/item-1");
    expect(revalidatePath).toHaveBeenCalledWith("/retete");
  });

  it("trimite factorul de conversie completat (virgula zecimala acceptata)", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    addOrUpdateComponent.mockResolvedValue(undefined);

    await addComponentAction(
      initialRecipeFormState,
      formData({
        recipe_id: "recipe-1",
        item_id: "item-1",
        component_item_id: "item-2",
        percentage: "30",
        conversion_factor: "1500,5",
      }),
    );

    expect(addOrUpdateComponent).toHaveBeenCalledWith(
      expect.objectContaining({ conversionFactor: 1500.5 }),
    );
  });

  it("respinge un factor de conversie nenumeric", async () => {
    requireRole.mockResolvedValue({ id: "u1" });

    const state = await addComponentAction(
      initialRecipeFormState,
      formData({
        recipe_id: "recipe-1",
        item_id: "item-1",
        component_item_id: "item-2",
        percentage: "30",
        conversion_factor: "abc",
      }),
    );

    expect(state.error).toMatch(/factor/i);
    expect(addOrUpdateComponent).not.toHaveBeenCalled();
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

describe("saveQuantityComponentsAction (modul Cantități reale)", () => {
  function rowsFormData(fields: Record<string, string>, rows: unknown): FormData {
    return formData({ ...fields, rows_json: JSON.stringify(rows) });
  }

  it("cere o cantitate de bază mai mare ca 0", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await saveQuantityComponentsAction(
      initialRecipeFormState,
      rowsFormData({ recipe_id: "recipe-1", item_id: "item-1", batch_qty: "0" }, [
        { componentItemId: "ciment", quantity: 150 },
      ]),
    );
    expect(state.error).toMatch(/cantitate de bază/i);
    expect(addOrUpdateComponents).not.toHaveBeenCalled();
  });

  it("cere cel putin un rand", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await saveQuantityComponentsAction(
      initialRecipeFormState,
      rowsFormData({ recipe_id: "recipe-1", item_id: "item-1", batch_qty: "1000" }, []),
    );
    expect(state.error).toMatch(/cel puțin o materie primă/i);
  });

  it("respinge auto-referinta (componenta = itemul propriu al retetei)", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await saveQuantityComponentsAction(
      initialRecipeFormState,
      rowsFormData({ recipe_id: "recipe-1", item_id: "item-1", batch_qty: "1000" }, [
        { componentItemId: "item-1", quantity: 150 },
      ]),
    );
    expect(state.error).toMatch(/propriei rețete/i);
  });

  it("respinge randuri duplicate ale aceluiasi material", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await saveQuantityComponentsAction(
      initialRecipeFormState,
      rowsFormData({ recipe_id: "recipe-1", item_id: "item-1", batch_qty: "1000" }, [
        { componentItemId: "ciment", quantity: 150 },
        { componentItemId: "ciment", quantity: 50 },
      ]),
    );
    expect(state.error).toMatch(/de două ori/i);
  });

  it("calculeaza procentele din cantitati si le salveaza prin addOrUpdateComponents", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    addOrUpdateComponents.mockResolvedValue(undefined);

    const state = await saveQuantityComponentsAction(
      initialRecipeFormState,
      rowsFormData({ recipe_id: "recipe-1", item_id: "item-1", batch_qty: "1000" }, [
        { componentItemId: "ciment", quantity: 150 },
        { componentItemId: "apa", quantity: 200 },
        { componentItemId: "nisip", quantity: 650 },
      ]),
    );

    expect(addOrUpdateComponents).toHaveBeenCalledWith("recipe-1", [
      { componentItemId: "ciment", percentage: 15 },
      { componentItemId: "apa", percentage: 20 },
      { componentItemId: "nisip", percentage: 65 },
    ]);
    expect(state.error).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/retete/item-1");
    expect(revalidatePath).toHaveBeenCalledWith("/retete");
  });

  it("propaga eroarea serviciului", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    addOrUpdateComponents.mockRejectedValue(new Error("boom"));

    const state = await saveQuantityComponentsAction(
      initialRecipeFormState,
      rowsFormData({ recipe_id: "recipe-1", item_id: "item-1", batch_qty: "1000" }, [
        { componentItemId: "ciment", quantity: 150 },
      ]),
    );

    expect(state.error).toBe("boom");
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
