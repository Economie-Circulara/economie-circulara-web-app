import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import {
  DuplicateCuiError,
  createClientRecord,
  deleteAddress,
  updateClientRecord,
  upsertAddress,
} from "./service";

afterEach(() => {
  vi.clearAllMocks();
});

function clientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-1",
    organization_id: "org-1",
    cui: "4183300",
    name: "SC Exemplu SRL",
    reg_com: "J40/1234/2001",
    is_vat_payer: true,
    hq_address: "Str. Exemplu 1",
    email: null,
    phone: null,
    contact_person: null,
    is_supplier: false,
    notes: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

function addressRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "addr-1",
    organization_id: "org-1",
    client_id: "client-1",
    label: "Depozit",
    address: "Str. X 1",
    is_default: true,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("createClientRecord", () => {
  it("normalizeaza CUI si insereaza clientul cu organization_id din sesiune", async () => {
    const single = vi.fn().mockResolvedValue({ data: clientRow(), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    createClient.mockResolvedValue({ from });

    const result = await createClientRecord({
      cui: "RO 4183 300",
      name: "SC Exemplu SRL",
      organizationId: "org-1",
    });

    expect(from).toHaveBeenCalledWith("clients");
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ organization_id: "org-1", cui: "4183300", name: "SC Exemplu SRL" }),
    );
    expect(result.id).toBe("client-1");
    expect(result.cui).toBe("4183300");
  });

  it("arunca DuplicateCuiError la incalcarea constrangerii unique(organization_id, cui)", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "duplicate key", code: "23505" } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ insert }) });

    await expect(
      createClientRecord({ cui: "4183300", name: "Duplicat SRL", organizationId: "org-1" }),
    ).rejects.toBeInstanceOf(DuplicateCuiError);
  });

  it("arunca o eroare generica pentru alte coduri de eroare", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "boom", code: "XX" } });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ insert }) });

    await expect(
      createClientRecord({ cui: "4183300", name: "X", organizationId: "org-1" }),
    ).rejects.toThrow("boom");
  });
});

describe("updateClientRecord", () => {
  it("actualizeaza clientul si mapeaza randul intors", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: clientRow({ name: "Nume nou" }), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ update }) });

    const result = await updateClientRecord({ id: "client-1", cui: "4183300", name: "Nume nou" });

    expect(eq).toHaveBeenCalledWith("id", "client-1");
    expect(result.name).toBe("Nume nou");
  });

  it("arunca DuplicateCuiError la editarea catre un CUI deja folosit", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "23505", message: "dup" } });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ update }) });

    await expect(
      updateClientRecord({ id: "client-1", cui: "4183300", name: "X" }),
    ).rejects.toBeInstanceOf(DuplicateCuiError);
  });
});

describe("upsertAddress — o singura adresa implicita per client", () => {
  it("la crearea unei adrese implicite, dezactiveaza intai orice alta adresa implicita a clientului", async () => {
    const clearEq2 = vi.fn().mockResolvedValue({ error: null });
    const clearEq1 = vi.fn().mockReturnValue({ eq: clearEq2 });
    const update = vi.fn().mockReturnValue({ eq: clearEq1 });

    const single = vi.fn().mockResolvedValue({ data: addressRow(), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });

    const from = vi.fn().mockReturnValue({ update, insert });
    createClient.mockResolvedValue({ from });

    await upsertAddress({
      clientId: "client-1",
      organizationId: "org-1",
      address: "Str. Noua 1",
      isDefault: true,
    });

    expect(update).toHaveBeenCalledWith({ is_default: false });
    expect(clearEq1).toHaveBeenCalledWith("client_id", "client-1");
    expect(clearEq2).toHaveBeenCalledWith("is_default", true);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ client_id: "client-1", is_default: true }),
    );
  });

  it("la editarea unei adrese existente catre implicit, exclude propria adresa din clear (.neq)", async () => {
    const neq = vi.fn().mockResolvedValue({ error: null });
    const clearEq2 = vi.fn().mockReturnValue({ neq });
    const clearEq1 = vi.fn().mockReturnValue({ eq: clearEq2 });
    const update = vi.fn().mockReturnValue({ eq: clearEq1 });

    const single = vi.fn().mockResolvedValue({ data: addressRow({ id: "addr-1" }), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eqUpdateTarget = vi.fn().mockReturnValue({ select });
    const updateTarget = vi.fn().mockReturnValue({ eq: eqUpdateTarget });

    let callCount = 0;
    const from = vi.fn().mockImplementation(() => {
      callCount += 1;
      // primul apel .from() e pt. clear-ul adresei implicite, al doilea pt. update-ul propriu-zis
      return callCount === 1 ? { update } : { update: updateTarget };
    });
    createClient.mockResolvedValue({ from });

    await upsertAddress({
      id: "addr-1",
      clientId: "client-1",
      organizationId: "org-1",
      address: "Str. Noua 1",
      isDefault: true,
    });

    expect(neq).toHaveBeenCalledWith("id", "addr-1");
  });

  it("nu atinge alte adrese cand isDefault e false", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: addressRow({ is_default: false }), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const update = vi.fn();
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ update, insert }) });

    await upsertAddress({
      clientId: "client-1",
      organizationId: "org-1",
      address: "Str. Noua 1",
      isDefault: false,
    });

    expect(update).not.toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ is_default: false }));
  });
});

describe("deleteAddress", () => {
  it("sterge adresa dupa id", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const del = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ delete: del }) });

    await deleteAddress("addr-1");

    expect(eq).toHaveBeenCalledWith("id", "addr-1");
  });

  it("arunca eroare cand stergerea esueaza", async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: "boom" } });
    const del = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ delete: del }) });

    await expect(deleteAddress("addr-1")).rejects.toThrow("Nu am putut șterge adresa.");
  });
});
