import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { listOrganizations } from "./queries";

/** Query builder Supabase fals: chainable si "thenable" (vezi stock/queries.test.ts). */
function makeQueryBuilder(finalResult: { data: unknown; error: unknown }) {
  const methods = ["select", "order", "not"] as const;
  const builder: Record<string, unknown> & { then: (resolve: (v: unknown) => void) => void } = {
    then: (resolve) => resolve(finalResult),
  };
  for (const m of methods) {
    builder[m] = vi.fn(() => builder);
  }
  return builder as Record<(typeof methods)[number] | "then", ReturnType<typeof vi.fn>> & {
    then: (resolve: (v: unknown) => void) => void;
  };
}

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
});

describe("listOrganizations", () => {
  it("mapeaza organizatiile si calculeaza numarul de useri per organizatie", async () => {
    const orgsBuilder = makeQueryBuilder({
      data: [
        {
          id: "org-1",
          name: "Acme Recycling",
          slug: "acme",
          custom_domain: null,
          status: "active",
          created_at: "2026-01-01T00:00:00.000Z",
        },
        {
          id: "org-2",
          name: "Beta Materials",
          slug: "beta",
          custom_domain: "trace.beta.ro",
          status: "suspended",
          created_at: "2026-02-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const profilesBuilder = makeQueryBuilder({
      data: [
        { organization_id: "org-1" },
        { organization_id: "org-1" },
        { organization_id: "org-2" },
        { organization_id: null },
      ],
      error: null,
    });

    const from = vi.fn((table: string) => {
      if (table === "organizations") return orgsBuilder;
      if (table === "profiles") return profilesBuilder;
      throw new Error(`tabel neasteptat: ${table}`);
    });
    createClient.mockResolvedValue({ from });

    const result = await listOrganizations();

    expect(result).toEqual([
      {
        id: "org-1",
        name: "Acme Recycling",
        slug: "acme",
        customDomain: null,
        status: "active",
        createdAt: "2026-01-01T00:00:00.000Z",
        userCount: 2,
        accessUrl: "/acme",
      },
      {
        id: "org-2",
        name: "Beta Materials",
        slug: "beta",
        customDomain: "trace.beta.ro",
        status: "suspended",
        createdAt: "2026-02-01T00:00:00.000Z",
        userCount: 1,
        accessUrl: "https://trace.beta.ro",
      },
    ]);
  });

  it("foloseste subdomeniul cand NEXT_PUBLIC_ROOT_DOMAIN e configurat si nu exista custom domain", async () => {
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "lateristrace.app";
    const orgsBuilder = makeQueryBuilder({
      data: [
        {
          id: "org-1",
          name: "Acme",
          slug: "acme",
          custom_domain: null,
          status: "active",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      error: null,
    });
    const profilesBuilder = makeQueryBuilder({ data: [], error: null });
    const from = vi.fn((table: string) =>
      table === "organizations" ? orgsBuilder : profilesBuilder,
    );
    createClient.mockResolvedValue({ from });

    const [result] = await listOrganizations();

    expect(result?.accessUrl).toBe("https://acme.lateristrace.app");
    expect(result?.userCount).toBe(0);
  });

  it("arunca eroare cand incarcarea organizatiilor esueaza", async () => {
    const orgsBuilder = makeQueryBuilder({ data: null, error: { message: "boom" } });
    const profilesBuilder = makeQueryBuilder({ data: [], error: null });
    const from = vi.fn((table: string) =>
      table === "organizations" ? orgsBuilder : profilesBuilder,
    );
    createClient.mockResolvedValue({ from });

    await expect(listOrganizations()).rejects.toThrow();
  });
});
