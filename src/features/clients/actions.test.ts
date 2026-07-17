import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { createClientRecord, updateClientRecord, upsertAddress, deleteAddress, DuplicateCuiError } =
  vi.hoisted(() => {
    class DuplicateCuiError extends Error {
      constructor(public readonly cui: string) {
        super(`Există deja un client cu CUI ${cui} în organizația ta.`);
        this.name = "DuplicateCuiError";
      }
    }
    return {
      createClientRecord: vi.fn(),
      updateClientRecord: vi.fn(),
      upsertAddress: vi.fn(),
      deleteAddress: vi.fn(),
      DuplicateCuiError,
    };
  });
vi.mock("./service", () => ({
  createClientRecord,
  updateClientRecord,
  upsertAddress,
  deleteAddress,
  DuplicateCuiError,
}));

const { lookup } = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("./cui-lookup", () => ({ defaultCuiLookupProvider: { lookup } }));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  createClientAction,
  deleteAddressAction,
  lookupCuiAction,
  updateClientAction,
  upsertAddressAction,
} from "./actions";

afterEach(() => {
  vi.clearAllMocks();
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createClientAction", () => {
  it("respinge cererea cand CUI lipseste", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    const state = await createClientAction({ error: null }, formData({ name: "X" }));
    expect(state.error).toMatch(/cui/i);
    expect(createClientRecord).not.toHaveBeenCalled();
  });

  it("respinge cererea cand denumirea lipseste", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    const state = await createClientAction({ error: null }, formData({ cui: "4183300" }));
    expect(state.error).toMatch(/denumire/i);
    expect(createClientRecord).not.toHaveBeenCalled();
  });

  it("creeaza clientul si redirectioneaza la /clienti/{id}", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    createClientRecord.mockResolvedValue({ id: "client-1" });

    await expect(
      createClientAction(
        { error: null },
        formData({ cui: "4183300", name: "SC Exemplu SRL", is_vat_payer: "on" }),
      ),
    ).rejects.toThrow("REDIRECT:/clienti/client-1");

    expect(createClientRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        cui: "4183300",
        name: "SC Exemplu SRL",
        isVatPayer: true,
        organizationId: "org-1",
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/clienti");
  });

  it("returneaza mesajul clar la CUI duplicat", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    createClientRecord.mockRejectedValue(new DuplicateCuiError("4183300"));

    const state = await createClientAction(
      { error: null },
      formData({ cui: "4183300", name: "SC Exemplu SRL" }),
    );

    expect(state.error).toMatch(/există deja un client/i);
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("updateClientAction", () => {
  it("cere un id de client valid", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    const state = await updateClientAction(
      { error: null },
      formData({ cui: "4183300", name: "X" }),
    );
    expect(state.error).toMatch(/client/i);
    expect(updateClientRecord).not.toHaveBeenCalled();
  });

  it("actualizeaza clientul si revalideaza paginile relevante", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    updateClientRecord.mockResolvedValue({ id: "client-1" });

    const state = await updateClientAction(
      { error: null },
      formData({ id: "client-1", cui: "4183300", name: "Nume nou" }),
    );

    expect(updateClientRecord).toHaveBeenCalledWith(
      expect.objectContaining({ id: "client-1", cui: "4183300", name: "Nume nou" }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/clienti/client-1");
    expect(state.error).toBeNull();
  });
});

describe("lookupCuiAction", () => {
  it("returneaza rezultatul cand lookup-ul reuseste", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    lookup.mockResolvedValue({
      cui: "4183300",
      name: "SC Exemplu SRL",
      address: null,
      regCom: null,
      isVatPayer: true,
    });

    const state = await lookupCuiAction("4183300");

    expect(state.error).toBeNull();
    expect(state.result?.name).toBe("SC Exemplu SRL");
  });

  it("degradeaza gratios cand lookup-ul esueaza (formularul ramane editabil)", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    lookup.mockRejectedValue(new Error("Serviciul ANAF nu a răspuns la timp."));

    const state = await lookupCuiAction("4183300");

    expect(state.result).toBeNull();
    expect(state.error).toBe("Serviciul ANAF nu a răspuns la timp.");
  });
});

describe("upsertAddressAction", () => {
  it("cere o adresa (text) obligatorie", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    const state = await upsertAddressAction({ error: null }, formData({ client_id: "client-1" }));
    expect(state.error).toMatch(/adresa/i);
    expect(upsertAddress).not.toHaveBeenCalled();
  });

  it("salveaza adresa si revalideaza pagina clientului", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    upsertAddress.mockResolvedValue({ id: "addr-1" });

    const state = await upsertAddressAction(
      { error: null },
      formData({ client_id: "client-1", address: "Str. X 1", is_default: "on" }),
    );

    expect(upsertAddress).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-1",
        organizationId: "org-1",
        address: "Str. X 1",
        isDefault: true,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/clienti/client-1");
    expect(state.error).toBeNull();
  });
});

describe("deleteAddressAction", () => {
  it("cere id + client_id valide", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await deleteAddressAction({ error: null }, formData({}));
    expect(state.error).toMatch(/adresă/i);
    expect(deleteAddress).not.toHaveBeenCalled();
  });

  it("sterge adresa si revalideaza", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    deleteAddress.mockResolvedValue(undefined);

    const state = await deleteAddressAction(
      { error: null },
      formData({ id: "addr-1", client_id: "client-1" }),
    );

    expect(deleteAddress).toHaveBeenCalledWith("addr-1");
    expect(revalidatePath).toHaveBeenCalledWith("/clienti/client-1");
    expect(state.error).toBeNull();
  });
});
