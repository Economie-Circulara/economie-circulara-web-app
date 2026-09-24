import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies - AGENTS.md §2.2) - dezactivarea utilizatorilor (migrarea 0035).
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ getCurrentUser }));

const { createAdminClient } = vi.hoisted(() => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { setAuthUsersBanned } from "./auth-ban";
import { deactivateUserAction, reactivateUserAction } from "./deactivation-actions";
import { deactivationError } from "./deactivation";

afterEach(() => {
  vi.clearAllMocks();
});

const ADMIN = { id: "admin-1", role: "admin" as const, organizationId: "org-1" };

describe("deactivationError (regula pura)", () => {
  it("adminul poate dezactiva un operator sau alt admin din organizatia lui", () => {
    expect(
      deactivationError(ADMIN, { id: "op-1", role: "operator", organizationId: "org-1" }),
    ).toBeNull();
    expect(
      deactivationError(ADMIN, { id: "adm-2", role: "admin", organizationId: "org-1" }),
    ).toBeNull();
  });

  it("adminul NU se poate dezactiva singur", () => {
    expect(deactivationError(ADMIN, { ...ADMIN })).toMatch(/propriul cont/);
  });

  it("un operator nu poate dezactiva pe nimeni", () => {
    expect(
      deactivationError(
        { id: "op-1", role: "operator", organizationId: "org-1" },
        { id: "op-2", role: "operator", organizationId: "org-1" },
      ),
    ).toMatch(/administratorul/);
  });

  it("contul unui client se blocheaza prin arhivarea clientului, nu de aici", () => {
    expect(
      deactivationError(ADMIN, { id: "cl-1", role: "client", organizationId: "org-1" }),
    ).toMatch(/arhivând clientul/);
  });

  it("nu peste granita de organizatie", () => {
    expect(
      deactivationError(ADMIN, { id: "op-9", role: "operator", organizationId: "org-2" }),
    ).toMatch(/organizația ta/);
  });
});

/** Client Supabase fals: select profil tinta + update status. */
function mockSupabase(target: unknown, updated: unknown = { id: "op-1" }) {
  const updateBuilder: Record<string, ReturnType<typeof vi.fn>> = {};
  updateBuilder.eq = vi.fn(() => updateBuilder);
  updateBuilder.select = vi.fn(() => updateBuilder);
  updateBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: updated, error: null });

  const selectBuilder: Record<string, ReturnType<typeof vi.fn>> = {};
  selectBuilder.eq = vi.fn(() => selectBuilder);
  selectBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: target, error: null });

  const update = vi.fn(() => updateBuilder);
  const select = vi.fn(() => selectBuilder);
  createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ select, update }) });
  return { update };
}

function mockAdminAuth() {
  const updateUserById = vi.fn().mockResolvedValue({ error: null });
  createAdminClient.mockReturnValue({ auth: { admin: { updateUserById } } });
  return updateUserById;
}

describe("deactivateUserAction / reactivateUserAction", () => {
  it("dezactiveaza un operator: profiles.status = suspended + ban in Auth", async () => {
    getCurrentUser.mockResolvedValue(ADMIN);
    const { update } = mockSupabase({ id: "op-1", role: "operator", organization_id: "org-1" });
    const updateUserById = mockAdminAuth();

    const result = await deactivateUserAction("op-1");

    expect(result).toEqual({ error: null });
    expect(update).toHaveBeenCalledWith({ status: "suspended" });
    expect(updateUserById).toHaveBeenCalledWith("op-1", { ban_duration: "876000h" });
    expect(revalidatePath).toHaveBeenCalledWith("/setari/utilizatori");
  });

  it("reactivarea readuce statusul activ si scoate ban-ul", async () => {
    getCurrentUser.mockResolvedValue(ADMIN);
    const { update } = mockSupabase({ id: "op-1", role: "operator", organization_id: "org-1" });
    const updateUserById = mockAdminAuth();

    await reactivateUserAction("op-1");

    expect(update).toHaveBeenCalledWith({ status: "active" });
    expect(updateUserById).toHaveBeenCalledWith("op-1", { ban_duration: "none" });
  });

  it("refuza auto-dezactivarea fara sa scrie nimic", async () => {
    getCurrentUser.mockResolvedValue(ADMIN);
    const { update } = mockSupabase({ id: "admin-1", role: "admin", organization_id: "org-1" });

    const result = await deactivateUserAction("admin-1");

    expect(result.error).toMatch(/propriul cont/);
    expect(update).not.toHaveBeenCalled();
  });

  it("UPDATE blocat de RLS (0 randuri) => eroare, fara ban", async () => {
    getCurrentUser.mockResolvedValue(ADMIN);
    mockSupabase({ id: "op-1", role: "operator", organization_id: "org-1" }, null);
    const updateUserById = mockAdminAuth();

    const result = await deactivateUserAction("op-1");

    expect(result.error).toMatch(/dezactiva/);
    expect(updateUserById).not.toHaveBeenCalled();
  });
});

describe("setAuthUsersBanned (best-effort)", () => {
  it("nu arunca daca clientul admin lipseste (env) - intoarce false", async () => {
    createAdminClient.mockImplementation(() => {
      throw new Error("lipsesc cheile");
    });
    await expect(setAuthUsersBanned(["u1"], true)).resolves.toBe(false);
  });

  it("lista goala => nimic de facut", async () => {
    await expect(setAuthUsersBanned([], true)).resolves.toBe(true);
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
