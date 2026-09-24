import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { createItem, updateItem } = vi.hoisted(() => ({
  createItem: vi.fn(),
  updateItem: vi.fn(),
}));
vi.mock("./service", () => ({ createItem, updateItem }));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { createItemAction, updateItemAction } from "./actions";
import { initialItemFormState } from "./action-state";

afterEach(() => {
  vi.clearAllMocks();
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createItemAction", () => {
  it("respinge cererea cand titlul lipseste", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    const state = await createItemAction(
      initialItemFormState,
      formData({ unit: "kg", kind: "physical" }),
    );
    expect(state.error).toMatch(/titlu/i);
    expect(createItem).not.toHaveBeenCalled();
  });

  it("respinge o unitate de masura necunoscuta", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    const state = await createItemAction(
      initialItemFormState,
      formData({ title: "Ciment", unit: "not-a-unit", kind: "physical" }),
    );
    expect(state.error).toMatch(/unitate/i);
    expect(createItem).not.toHaveBeenCalled();
  });

  it("respinge un tip de item necunoscut", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    const state = await createItemAction(
      initialItemFormState,
      formData({ title: "Ciment", unit: "kg", kind: "not-a-kind" }),
    );
    expect(state.error).toMatch(/tip/i);
    expect(createItem).not.toHaveBeenCalled();
  });

  it("creeaza un abonament si redirectioneaza la /abonamente cand datele sunt valide", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    createItem.mockResolvedValue({ id: "item-1" });

    await expect(
      createItemAction(
        initialItemFormState,
        formData({
          title: "Basic PaaS",
          unit: "bucata",
          kind: "service",
          sellable: "on",
          description: "Abonament lunar",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/abonamente");

    expect(createItem).toHaveBeenCalledWith({
      id: expect.any(String),
      organizationId: "org-1",
      title: "Basic PaaS",
      description: "Abonament lunar",
      unit: "bucata",
      kind: "service",
      // Serviciile nu au comutator de urmarire in formular - mereu `true`
      // (irelevant: sunt sarite de la stoc pe ramura de `kind`). Migrarea 0029.
      isTracked: true,
      sellable: true,
      imageUrl: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/abonamente");
  });

  it("trateaza checkbox-ul necompletat (vandabil) ca false", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    createItem.mockResolvedValue({ id: "item-1" });

    await expect(
      createItemAction(
        initialItemFormState,
        formData({ title: "Nisip", unit: "kg", kind: "physical" }),
      ),
    ).rejects.toThrow("REDIRECT:/itemi");

    expect(createItem).toHaveBeenCalledWith(expect.objectContaining({ sellable: false }));
  });

  it("trateaza checkbox-ul 'Urmărește stocul' necompletat ca item nelimitat (fizic)", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    createItem.mockResolvedValue({ id: "item-1" });

    await expect(
      createItemAction(
        initialItemFormState,
        formData({ title: "Apă tehnologică", unit: "litru", kind: "physical" }),
      ),
    ).rejects.toThrow("REDIRECT:/itemi");

    expect(createItem).toHaveBeenCalledWith(expect.objectContaining({ isTracked: false }));
  });

  it("pastreaza urmarirea stocului cand checkbox-ul e bifat", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    createItem.mockResolvedValue({ id: "item-1" });

    await expect(
      createItemAction(
        initialItemFormState,
        formData({ title: "Nisip", unit: "tona", kind: "physical", is_tracked: "on" }),
      ),
    ).rejects.toThrow("REDIRECT:/itemi");

    expect(createItem).toHaveBeenCalledWith(expect.objectContaining({ isTracked: true }));
  });

  it("returneaza eroarea serviciului fara redirect", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    createItem.mockRejectedValue(new Error("Nu am putut crea materialul sau abonamentul."));

    const state = await createItemAction(
      initialItemFormState,
      formData({ title: "X", unit: "kg", kind: "physical" }),
    );

    expect(state.error).toBe("Nu am putut crea materialul sau abonamentul.");
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("updateItemAction", () => {
  it("cere un id valid", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    const state = await updateItemAction(
      initialItemFormState,
      formData({ title: "X", unit: "kg", kind: "physical" }),
    );
    expect(state.error).toMatch(/material|serviciu/i);
    expect(updateItem).not.toHaveBeenCalled();
  });

  it("actualizeaza itemul si redirectioneaza la /itemi", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    updateItem.mockResolvedValue({ id: "item-1" });

    await expect(
      updateItemAction(
        initialItemFormState,
        formData({ id: "item-1", title: "Ciment CEM II", unit: "kg", kind: "physical" }),
      ),
    ).rejects.toThrow("REDIRECT:/itemi");

    expect(updateItem).toHaveBeenCalledWith(
      "item-1",
      expect.objectContaining({ title: "Ciment CEM II", unit: "kg", kind: "physical" }),
    );
  });

  it("propaga eroarea serviciului (ex. item inexistent)", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    updateItem.mockRejectedValue(new Error("Nu am putut salva materialul sau abonamentul."));

    const state = await updateItemAction(
      initialItemFormState,
      formData({ id: "item-x", title: "X", unit: "kg", kind: "physical" }),
    );

    expect(state.error).toBe("Nu am putut salva materialul sau abonamentul.");
  });
});
