import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { listClients } = vi.hoisted(() => ({ listClients: vi.fn() }));
vi.mock("@/features/clients/queries", () => ({ listClients }));

const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { getClientPortalStatus, listAvailableClientsForInvite, listOrgUsers } from "./queries";

afterEach(() => {
  vi.clearAllMocks();
});

describe("listOrgUsers", () => {
  it("mapeaza utilizatorii, inclusiv firma clientilor (embed clients(name))", async () => {
    const order = vi.fn().mockResolvedValue({
      data: [
        {
          id: "u1",
          email: "admin@acme.ro",
          full_name: "Admin Acme",
          role: "admin",
          status: "active",
          clients: null,
        },
        {
          id: "u2",
          email: "client@acme.ro",
          full_name: "Ion Popescu",
          role: "client",
          status: "active",
          clients: { name: "SC Exemplu SRL" },
        },
      ],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ order });
    const from = vi.fn().mockReturnValue({ select });
    createClient.mockResolvedValue({ from });

    const result = await listOrgUsers();

    expect(from).toHaveBeenCalledWith("profiles");
    // Embed dezambiguizat: din 0035 exista si `clients.archived_by -> profiles`, deci
    // `clients(name)` simplu ar fi refuzat de PostgREST (PGRST201).
    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("clients!profiles_client_id_fkey(name)"),
    );
    expect(result).toHaveLength(2);
    expect(result[0].clientName).toBeNull();
    expect(result[1].clientName).toBe("SC Exemplu SRL");
  });

  it("returneaza lista goala cand nu exista date", async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn().mockReturnValue({ order });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) });

    expect(await listOrgUsers()).toEqual([]);
  });
});

describe("listAvailableClientsForInvite", () => {
  function clientRow(overrides: Record<string, unknown> = {}) {
    return {
      id: "client-1",
      cui: "111",
      name: "Firma A",
      regCom: null,
      isVatPayer: false,
      hqAddress: null,
      email: null,
      phone: null,
      contactPerson: null,
      isSupplier: false,
      notes: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      ...overrides,
    };
  }

  it("exclude firmele care au deja un profil client legat", async () => {
    listClients.mockResolvedValue([
      clientRow({ id: "client-1", name: "Firma A" }),
      clientRow({ id: "client-2", name: "Firma B" }),
    ]);
    const not = vi.fn().mockResolvedValue({ data: [{ client_id: "client-1" }], error: null });
    const select = vi.fn().mockReturnValue({ not });
    const from = vi.fn().mockReturnValue({ select });
    createClient.mockResolvedValue({ from });

    const result = await listAvailableClientsForInvite();

    expect(from).toHaveBeenCalledWith("profiles");
    expect(not).toHaveBeenCalledWith("client_id", "is", null);
    expect(result).toEqual([{ id: "client-2", name: "Firma B", cui: "111" }]);
  });

  it("returneaza toate firmele cand niciuna nu are inca un utilizator", async () => {
    listClients.mockResolvedValue([clientRow({ id: "client-1", name: "Firma A" })]);
    const not = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn().mockReturnValue({ not });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) });

    const result = await listAvailableClientsForInvite();

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("client-1");
  });
});

describe("getClientPortalStatus", () => {
  function mockProfile(profile: { id: string; email: string | null } | null) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select }) });
  }
  function mockAuthUser(result: { data: unknown; error: unknown }) {
    const getUserById = vi.fn().mockResolvedValue(result);
    createAdminClient.mockReturnValue({ auth: { admin: { getUserById } } });
    return getUserById;
  }

  it("none cand firma nu are profil client", async () => {
    mockProfile(null);
    expect(await getClientPortalStatus("client-1")).toEqual({ status: "none" });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("pending cand contul nu a fost activat", async () => {
    mockProfile({ id: "user-1", email: "c@acme.ro" });
    const getUserById = mockAuthUser({
      data: { user: { email_confirmed_at: null, last_sign_in_at: null } },
      error: null,
    });
    expect(await getClientPortalStatus("client-1")).toEqual({
      status: "pending",
      email: "c@acme.ro",
    });
    expect(getUserById).toHaveBeenCalledWith("user-1");
  });

  it("active cand emailul e confirmat", async () => {
    mockProfile({ id: "user-1", email: "c@acme.ro" });
    mockAuthUser({
      data: { user: { email_confirmed_at: "2026-09-20T10:00:00Z", last_sign_in_at: null } },
      error: null,
    });
    expect(await getClientPortalStatus("client-1")).toEqual({
      status: "active",
      email: "c@acme.ro",
    });
  });

  it("active (conservator) cand verificarea in Auth esueaza", async () => {
    mockProfile({ id: "user-1", email: "c@acme.ro" });
    createAdminClient.mockImplementation(() => {
      throw new Error("lipsesc cheile");
    });
    expect(await getClientPortalStatus("client-1")).toEqual({
      status: "active",
      email: "c@acme.ro",
    });
  });
});
