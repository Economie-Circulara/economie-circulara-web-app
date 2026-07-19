import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

// redirect() arunca (ca in Next) ca sa putem verifica destinatia.
const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

import {
  getCurrentUser,
  homePathForRole,
  isOrgSuspended,
  requireRole,
  requireUser,
  type UserRole,
} from "./session";

/** Construieste un client Supabase fals cu user + profil date. */
function mockSupabase(user: { id: string; email?: string } | null, profile: unknown) {
  createClient.mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi
            .fn()
            .mockResolvedValue({ data: profile, error: profile ? null : { code: "PGRST116" } }),
        }),
      }),
    }),
  });
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("homePathForRole", () => {
  const cases: [UserRole, string][] = [
    ["admin", "/dashboard"],
    ["operator", "/dashboard"],
    ["client", "/portal"],
    ["super_admin", "/platform"],
  ];
  it.each(cases)("%s -> %s", (role, path) => {
    expect(homePathForRole(role)).toBe(path);
  });
});

describe("getCurrentUser", () => {
  it("returneaza null cand nu e autentificat", async () => {
    mockSupabase(null, null);
    expect(await getCurrentUser()).toBeNull();
  });

  it("returneaza null cand userul nu are profil", async () => {
    mockSupabase({ id: "u1", email: "u1@test.ro" }, null);
    expect(await getCurrentUser()).toBeNull();
  });

  it("mapeaza profilul in SessionUser", async () => {
    mockSupabase(
      { id: "u1", email: "auth@test.ro" },
      {
        role: "admin",
        organization_id: "org1",
        client_id: null,
        full_name: "Ana",
        email: "profile@test.ro",
        organizations: { status: "active" },
      },
    );
    expect(await getCurrentUser()).toEqual({
      id: "u1",
      email: "profile@test.ro",
      role: "admin",
      organizationId: "org1",
      clientId: null,
      fullName: "Ana",
      organizationStatus: "active",
    });
  });

  it("organizationStatus e null pentru super_admin (fara organizatie)", async () => {
    mockSupabase(
      { id: "u-super", email: "super@test.ro" },
      {
        role: "super_admin",
        organization_id: null,
        client_id: null,
        full_name: null,
        email: "super@test.ro",
        organizations: null,
      },
    );
    const user = await getCurrentUser();
    expect(user?.organizationId).toBeNull();
    expect(user?.organizationStatus).toBeNull();
  });
});

describe("isOrgSuspended", () => {
  it("adevarat doar cand exista organizatie SI statusul e suspended", () => {
    expect(isOrgSuspended({ organizationId: "o1", organizationStatus: "suspended" })).toBe(true);
    expect(isOrgSuspended({ organizationId: "o1", organizationStatus: "active" })).toBe(false);
    // super_admin: fara organizatie -> niciodata "suspendat" pe aceasta cale.
    expect(isOrgSuspended({ organizationId: null, organizationStatus: "suspended" })).toBe(false);
  });
});

describe("requireUser - guard organizatie suspendata (T2.1)", () => {
  it("redirecteaza la /organizatie-suspendata cand organizatia userului e suspendata", async () => {
    mockSupabase(
      { id: "u1" },
      {
        role: "admin",
        organization_id: "org1",
        client_id: null,
        full_name: null,
        email: "admin@test.ro",
        organizations: { status: "suspended" },
      },
    );
    await expect(requireUser()).rejects.toThrow("REDIRECT:/organizatie-suspendata");
  });

  it("permite accesul cand organizatia e activa", async () => {
    mockSupabase(
      { id: "u1" },
      {
        role: "operator",
        organization_id: "org1",
        client_id: null,
        full_name: null,
        email: "op@test.ro",
        organizations: { status: "active" },
      },
    );
    const user = await requireUser();
    expect(user.role).toBe("operator");
  });

  it("super_admin (fara organizatie) nu e afectat de guard-ul de suspendare", async () => {
    mockSupabase(
      { id: "u-super" },
      {
        role: "super_admin",
        organization_id: null,
        client_id: null,
        full_name: null,
        email: "super@test.ro",
        organizations: null,
      },
    );
    const user = await requireUser();
    expect(user.role).toBe("super_admin");
  });
});

describe("requireRole", () => {
  it("redirecteaza la /login cand nu e autentificat", async () => {
    mockSupabase(null, null);
    await expect(requireRole(["admin"])).rejects.toThrow("REDIRECT:/login");
  });

  it("redirecteaza la dashboard-ul rolului propriu cand rolul nu e permis", async () => {
    mockSupabase(
      { id: "u2" },
      { role: "client", organization_id: "o", client_id: "c", full_name: null, email: "c@test.ro" },
    );
    await expect(requireRole(["admin", "operator"])).rejects.toThrow("REDIRECT:/portal");
  });

  it("permite accesul cand rolul e in lista", async () => {
    mockSupabase(
      { id: "u3" },
      {
        role: "operator",
        organization_id: "o",
        client_id: null,
        full_name: null,
        email: "op@test.ro",
      },
    );
    const user = await requireRole(["admin", "operator"]);
    expect(user.role).toBe("operator");
  });
});
