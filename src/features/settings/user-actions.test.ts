import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies — AGENTS.md §2.2).
const { headers } = vi.hoisted(() => ({ headers: vi.fn() }));
vi.mock("next/headers", () => ({ headers }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ getCurrentUser }));

const { getClient } = vi.hoisted(() => ({ getClient: vi.fn() }));
vi.mock("@/features/clients/queries", () => ({ getClient }));

import { inviteClientAction, inviteStaffAction } from "./user-actions";
import { initialUserMgmtState } from "./form-state";

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

function clientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-1",
    cui: "12345678",
    name: "SC Exemplu SRL",
    regCom: null,
    isVatPayer: false,
    hqAddress: null,
    email: null,
    phone: null,
    contactPerson: "Ion Popescu",
    isSupplier: false,
    notes: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

const ADMIN = { id: "admin-1", role: "admin", organizationId: "org-1" };

beforeEach(() => {
  headers.mockResolvedValue(
    new Map([
      ["x-forwarded-proto", "https"],
      ["host", "app.lateristrace.ro"],
    ]),
  );
  getCurrentUser.mockResolvedValue(ADMIN);
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("inviteStaffAction — gating rol", () => {
  it("respinge cererea daca userul curent nu e admin", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "operator", organizationId: "org-1" });

    const state = await inviteStaffAction(
      initialUserMgmtState,
      formData({ email: "op@acme.ro", role: "operator" }),
    );

    expect(state.error).toMatch(/permisiunea/i);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("respinge cererea daca nu exista sesiune", async () => {
    getCurrentUser.mockResolvedValue(null);

    const state = await inviteStaffAction(
      initialUserMgmtState,
      formData({ email: "op@acme.ro", role: "operator" }),
    );

    expect(state.error).toMatch(/permisiunea/i);
  });
});

describe("inviteClientAction — gating rol", () => {
  it("respinge cererea daca userul curent nu e admin", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "operator", organizationId: "org-1" });

    const state = await inviteClientAction(
      initialUserMgmtState,
      formData({ email: "client@acme.ro", client_id: "client-1" }),
    );

    expect(state.error).toMatch(/permisiunea/i);
    expect(getClient).not.toHaveBeenCalled();
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("respinge un client (rol) care incearca sa invite", async () => {
    getCurrentUser.mockResolvedValue({ id: "u1", role: "client", organizationId: "org-1" });

    const state = await inviteClientAction(
      initialUserMgmtState,
      formData({ email: "client@acme.ro", client_id: "client-1" }),
    );

    expect(state.error).toMatch(/permisiunea/i);
  });
});

describe("inviteClientAction — validare", () => {
  it("respinge cererea fara client_id", async () => {
    const state = await inviteClientAction(
      initialUserMgmtState,
      formData({ email: "client@acme.ro", client_id: "" }),
    );

    expect(state.error).toMatch(/firm/i);
    expect(getClient).not.toHaveBeenCalled();
  });

  it("respinge cererea fara email", async () => {
    const state = await inviteClientAction(
      initialUserMgmtState,
      formData({ client_id: "client-1", email: "" }),
    );

    expect(state.error).toMatch(/email/i);
    expect(getClient).not.toHaveBeenCalled();
  });

  it("respinge un email cu format invalid", async () => {
    const state = await inviteClientAction(
      initialUserMgmtState,
      formData({ client_id: "client-1", email: "nu-e-email" }),
    );

    expect(state.error).toMatch(/valid/i);
    expect(getClient).not.toHaveBeenCalled();
  });

  it("respinge cand firma nu exista/nu e accesibila (getClient -> null)", async () => {
    getClient.mockResolvedValue(null);

    const state = await inviteClientAction(
      initialUserMgmtState,
      formData({ client_id: "client-x", email: "client@acme.ro" }),
    );

    expect(state.error).toMatch(/nu exista/i);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("respinge cand firma are deja un utilizator client asociat", async () => {
    getClient.mockResolvedValue(clientRow());
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "existing-user" }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    createAdminClient.mockReturnValue({ from });

    const state = await inviteClientAction(
      initialUserMgmtState,
      formData({ client_id: "client-1", email: "client@acme.ro" }),
    );

    expect(state.error).toMatch(/deja un utilizator/i);
    expect(from).toHaveBeenCalledWith("profiles");
    expect(eq).toHaveBeenCalledWith("client_id", "client-1");
  });
});

describe("inviteClientAction — flux fericit", () => {
  function mockAdminHappyPath() {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const inviteUserByEmail = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn((table: string) => {
      if (table === "profiles") return { select, insert };
      throw new Error(`tabel neasteptat: ${table}`);
    });
    createAdminClient.mockReturnValue({ from, auth: { admin: { inviteUserByEmail } } });
    return { select, eq, maybeSingle, inviteUserByEmail, insert, from };
  }

  it("invita clientul, creeaza profilul legat de firma si revalideaza pagina", async () => {
    getClient.mockResolvedValue(clientRow());
    const { inviteUserByEmail, insert } = mockAdminHappyPath();

    const state = await inviteClientAction(
      initialUserMgmtState,
      formData({ client_id: "client-1", email: "Client@Acme.ro" }),
    );

    expect(inviteUserByEmail).toHaveBeenCalledWith("client@acme.ro", {
      redirectTo: "https://app.lateristrace.ro/auth/callback?next=/set-password",
    });
    expect(insert).toHaveBeenCalledWith({
      id: "user-1",
      organization_id: "org-1",
      role: "client",
      client_id: "client-1",
      full_name: "Ion Popescu",
      email: "client@acme.ro",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/setari/utilizatori");
    expect(state.error).toBeNull();
    expect(state.message).toMatch(/client@acme\.ro/);
  });

  it("raporteaza eroare cand invitatia Supabase esueaza", async () => {
    getClient.mockResolvedValue(clientRow());
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const inviteUserByEmail = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "cont deja existent" } });
    createAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select }),
      auth: { admin: { inviteUserByEmail } },
    });

    const state = await inviteClientAction(
      initialUserMgmtState,
      formData({ client_id: "client-1", email: "client@acme.ro" }),
    );

    expect(state.error).toMatch(/nu am putut trimite/i);
  });

  it("raporteaza eroare distincta cand profilul nu poate fi salvat dupa invitatie", async () => {
    getClient.mockResolvedValue(clientRow());
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const inviteUserByEmail = vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    const insert = vi.fn().mockResolvedValue({ error: { message: "constraint esuat" } });
    createAdminClient.mockReturnValue({
      from: vi.fn().mockReturnValue({ select, insert }),
      auth: { admin: { inviteUserByEmail } },
    });

    const state = await inviteClientAction(
      initialUserMgmtState,
      formData({ client_id: "client-1", email: "client@acme.ro" }),
    );

    expect(state.error).toMatch(/profilul nu a putut fi salvat/i);
  });
});
