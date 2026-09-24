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

/**
 * Query builder fals, chainable (select/order/is/or intorc `this`) si "thenable" ca
 * PostgrestFilterBuilder - rezolva la `finalResult` cand e asteptat.
 */
function makeListBuilder(finalResult: { data: unknown; error: unknown }) {
  const builder: Record<string, ReturnType<typeof vi.fn>> & {
    then: (resolve: (v: unknown) => void) => void;
  } = { then: (resolve: (v: unknown) => void) => resolve(finalResult) } as never;
  for (const m of ["select", "order", "is", "or"]) {
    builder[m] = vi.fn(() => builder);
  }
  return builder;
}

describe("listClients", () => {
  it("nu aplica filtru de cautare cand search e absent", async () => {
    const builder = makeListBuilder({ data: [clientRow()], error: null });
    const from = vi.fn().mockReturnValue(builder);
    createClient.mockResolvedValue({ from });

    const result = await listClients();

    expect(from).toHaveBeenCalledWith("clients");
    expect(builder.or).not.toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("SC Exemplu SRL");
    expect(result[0].archivedAt).toBeNull();
  });

  it("ascunde implicit clientii arhivati (migrarea 0035)", async () => {
    const builder = makeListBuilder({ data: [], error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await listClients();

    expect(builder.is).toHaveBeenCalledWith("archived_at", null);
  });

  it("include arhivatii doar la cerere explicita (comutatorul 'Arată arhivați')", async () => {
    const builder = makeListBuilder({
      data: [clientRow({ archived_at: "2026-09-01T00:00:00.000Z" })],
      error: null,
    });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    const result = await listClients({ includeArchived: true });

    expect(builder.is).not.toHaveBeenCalled();
    expect(result[0].archivedAt).toBe("2026-09-01T00:00:00.000Z");
  });

  it("cauta dupa denumire SAU CUI (ilike, or())", async () => {
    const builder = makeListBuilder({ data: [], error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await listClients({ search: "exemplu" });

    expect(builder.or).toHaveBeenCalledWith("name.ilike.%exemplu%,cui.ilike.%exemplu%");
  });

  it("arunca eroare cand interogarea esueaza", async () => {
    const builder = makeListBuilder({ data: null, error: { message: "boom" } });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

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
