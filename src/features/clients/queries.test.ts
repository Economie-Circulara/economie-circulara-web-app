import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { getClient, listClientAddresses, listClients } from "./queries";

afterEach(() => {
  vi.clearAllMocks();
});

function clientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-1",
    organization_id: "org-1",
    cui: "4183300",
    name: "SC Exemplu SRL",
    reg_com: null,
    is_vat_payer: false,
    hq_address: null,
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

describe("listClients", () => {
  it("nu aplica filtru de cautare cand search e absent", async () => {
    const order = vi.fn().mockResolvedValue({ data: [clientRow()], error: null });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select });
    createClient.mockResolvedValue({ from });

    const result = await listClients();

    expect(from).toHaveBeenCalledWith("clients");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("SC Exemplu SRL");
  });

  it("cauta dupa denumire SAU CUI (ilike, or())", async () => {
    const or = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn().mockReturnValue({ or });
    const select = vi.fn().mockReturnValue({ order });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) });

    await listClients({ search: "exemplu" });

    expect(or).toHaveBeenCalledWith("name.ilike.%exemplu%,cui.ilike.%exemplu%");
  });

  it("arunca eroare cand interogarea esueaza", async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const select = vi.fn().mockReturnValue({ order });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) });

    await expect(listClients()).rejects.toThrow("Nu am putut încărca lista de clienți.");
  });
});

describe("getClient", () => {
  it("returneaza null cand clientul nu exista/nu e accesibil", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) });

    expect(await getClient("client-x")).toBeNull();
  });

  it("mapeaza randul gasit", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: clientRow(), error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) });

    const client = await getClient("client-1");
    expect(client?.id).toBe("client-1");
  });
});

describe("listClientAddresses", () => {
  it("ordoneaza adresa implicita prima", async () => {
    const orderCreated = vi.fn().mockResolvedValue({
      data: [
        {
          id: "a2",
          client_id: "c1",
          label: null,
          address: "B",
          is_default: false,
          created_at: "t2",
        },
      ],
      error: null,
    });
    const orderDefault = vi.fn().mockReturnValue({ order: orderCreated });
    const eq = vi.fn().mockReturnValue({ order: orderDefault });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    createClient.mockResolvedValue({ from });

    const result = await listClientAddresses("c1");

    expect(eq).toHaveBeenCalledWith("client_id", "c1");
    expect(orderDefault).toHaveBeenCalledWith("is_default", { ascending: false });
    expect(result).toHaveLength(1);
  });
});
