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

import { getCurrentUser, homePathForRole, requireRole, type UserRole } from "./session";

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
      },
    );
    expect(await getCurrentUser()).toEqual({
      id: "u1",
      email: "profile@test.ro",
      role: "admin",
      organizationId: "org1",
      clientId: null,
      fullName: "Ana",
    });
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
