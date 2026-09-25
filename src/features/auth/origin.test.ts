import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { headersGet, createAdminClient } = vi.hoisted(() => ({
  headersGet: vi.fn(),
  createAdminClient: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => ({ get: headersGet }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient }));

import { getOrganizationOrigin, getOriginForEmail, getRequestTenantOrigin } from "./origin";

/** Client admin fals: orice lant `.from().select().eq()...maybeSingle()` intoarce `result`. */
function mockAdmin(result: { data: unknown; error?: unknown }) {
  const chain: Record<string, unknown> = {};
  const eq = vi.fn(() => chain);
  chain.eq = eq;
  chain.maybeSingle = vi.fn().mockResolvedValue({ error: null, ...result });
  const from = vi.fn(() => ({ select: vi.fn(() => chain) }));
  createAdminClient.mockReturnValue({ from });
  return { from, eq };
}

function mockHost(host: string | null) {
  headersGet.mockImplementation((name: string) => (name === "host" ? host : null));
}

beforeEach(() => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.lotculot.eu";
  mockHost("www.lotculot.eu");
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("getOrganizationOrigin", () => {
  it("intoarce domeniul propriu al organizatiei tinta", async () => {
    const { from, eq } = mockAdmin({ data: { custom_domain: "trace.acme.ro" } });

    await expect(getOrganizationOrigin("org-1")).resolves.toBe("https://trace.acme.ro");
    expect(from).toHaveBeenCalledWith("organizations");
    expect(eq).toHaveBeenCalledWith("id", "org-1");
  });

  it("cade pe originea canonica fara domeniu propriu", async () => {
    mockAdmin({ data: { custom_domain: null } });

    await expect(getOrganizationOrigin("org-1")).resolves.toBe("https://www.lotculot.eu");
  });

  it("cade pe originea canonica daca lookup-ul arunca (ex. lipsa cheie secreta)", async () => {
    createAdminClient.mockImplementation(() => {
      throw new Error("missing key");
    });

    await expect(getOrganizationOrigin("org-1")).resolves.toBe("https://www.lotculot.eu");
  });
});

describe("getOriginForEmail", () => {
  it("intoarce domeniul organizatiei careia ii apartine emailul", async () => {
    const { eq } = mockAdmin({ data: { organizations: { custom_domain: "trace.acme.ro" } } });

    await expect(getOriginForEmail("ana@acme.ro")).resolves.toBe("https://trace.acme.ro");
    expect(eq).toHaveBeenCalledWith("email", "ana@acme.ro");
  });

  it("email necunoscut / fara organizatie -> originea cererii", async () => {
    mockAdmin({ data: null });

    await expect(getOriginForEmail("nimeni@x.ro")).resolves.toBe("https://www.lotculot.eu");
  });
});

describe("getRequestTenantOrigin", () => {
  it("pastreaza hostul cererii cand e domeniul unei organizatii active", async () => {
    mockHost("Trace.Acme.ro:443");
    const { eq } = mockAdmin({ data: { custom_domain: "trace.acme.ro" } });

    await expect(getRequestTenantOrigin()).resolves.toBe("https://trace.acme.ro");
    expect(eq).toHaveBeenCalledWith("custom_domain", "trace.acme.ro");
    expect(eq).toHaveBeenCalledWith("status", "active");
  });

  it("un host necunoscut nu ajunge in redirectTo - cade pe originea canonica", async () => {
    mockHost("evil.example.com");
    mockAdmin({ data: null });

    await expect(getRequestTenantOrigin()).resolves.toBe("https://www.lotculot.eu");
  });
});
