import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TENANT_DOMAIN_HEADER, TENANT_SLUG_HEADER } from "@/features/auth/tenant";

// `vi.mock` este ridicat (hoisted) deasupra importurilor, deci definim mock-urile cu
// `vi.hoisted` ca sa fie disponibile in factory.
const { getUser, createServerClient, singleMock } = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerClient: vi.fn(),
  // Mock-ul lantului `.from("profiles").select(...).eq(...).single()` folosit de
  // guard-ul de organizatie suspendata (T2.1). Implicit: fara profil rezolvat (ca un
  // user fara organizatie) — testele T2.1 il suprascriu explicit per caz.
  singleMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) => createServerClient(...args),
}));

vi.mock("@/lib/env", () => ({
  getSupabaseEnv: () => ({ url: "http://localhost:54321", publishableKey: "sb_publishable_test" }),
}));

import { updateSession } from "./middleware";

/** Extrage headerul de request suprascris prin `NextResponse.next({ request: { headers } })`. */
function requestHeaderOverride(response: Response, name: string): string | null {
  return response.headers.get(`x-middleware-request-${name}`);
}

function makeRequest(url: string, headers: Record<string, string>): NextRequest {
  return new NextRequest(url, { headers: new Headers(headers) });
}

beforeEach(() => {
  singleMock.mockResolvedValue({ data: null, error: null });
  createServerClient.mockReturnValue({
    auth: { getUser },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ single: singleMock }),
      }),
    }),
  });
});

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_ROOT_DOMAIN;
});

describe("updateSession - propagare tenant pe request headers", () => {
  it("seteaza x-tenant-slug pe REQUEST headers (nu pe response headers) cand userul e autentificat", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const request = makeRequest("http://localhost:3000/acme/comenzi", { host: "localhost:3000" });

    const response = await updateSession(request);

    expect(requestHeaderOverride(response, TENANT_SLUG_HEADER)).toBe("acme");
    // Headerul brut de raspuns nu trebuie folosit pentru propagare (nu ajunge la server).
    expect(response.headers.get(TENANT_SLUG_HEADER)).toBeNull();
  });

  it("seteaza x-tenant-domain pentru un custom domain", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    process.env.NEXT_PUBLIC_ROOT_DOMAIN = "lateristrace.app";
    const request = makeRequest("https://trace.acme.ro/comenzi", { host: "trace.acme.ro" });

    const response = await updateSession(request);

    expect(requestHeaderOverride(response, TENANT_DOMAIN_HEADER)).toBe("trace.acme.ro");
  });

  it("nu seteaza header de tenant cand nu exista un tenant rezolvat", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const request = makeRequest("http://localhost:3000/dashboard", { host: "localhost:3000" });

    const response = await updateSession(request);

    expect(requestHeaderOverride(response, TENANT_SLUG_HEADER)).toBeNull();
  });
});

describe("updateSession - guard de autentificare", () => {
  it("redirecteaza la /login cu `next` cand nu exista sesiune pe o ruta protejata", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const request = makeRequest("http://localhost:3000/dashboard", { host: "localhost:3000" });

    const response = await updateSession(request);

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard");
  });

  it("lasa prin rutele publice (ex. /login) fara sesiune", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const request = makeRequest("http://localhost:3000/login", { host: "localhost:3000" });

    const response = await updateSession(request);

    expect(response.status).not.toBe(307);
  });
});

describe("updateSession - guard organizatie suspendata (T2.1)", () => {
  it("redirecteaza la /organizatie-suspendata cand organizatia userului e suspendata", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    singleMock.mockResolvedValue({
      data: { organization_id: "org-1", organizations: { status: "suspended" } },
      error: null,
    });
    const request = makeRequest("http://localhost:3000/dashboard", { host: "localhost:3000" });

    const response = await updateSession(request);

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/organizatie-suspendata");
  });

  it("nu redirecteaza cand organizatia userului e activa", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    singleMock.mockResolvedValue({
      data: { organization_id: "org-1", organizations: { status: "active" } },
      error: null,
    });
    const request = makeRequest("http://localhost:3000/dashboard", { host: "localhost:3000" });

    const response = await updateSession(request);

    expect(response.status).not.toBe(307);
  });

  it("nu redirecteaza super_admin (fara organizatie), chiar daca ar exista o organizatie", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u-super" } } });
    singleMock.mockResolvedValue({
      data: { organization_id: null, organizations: null },
      error: null,
    });
    const request = makeRequest("http://localhost:3000/platform", { host: "localhost:3000" });

    const response = await updateSession(request);

    expect(response.status).not.toBe(307);
  });

  it("nu creeaza bucla de redirect pe /organizatie-suspendata insasi", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    singleMock.mockResolvedValue({
      data: { organization_id: "org-1", organizations: { status: "suspended" } },
      error: null,
    });
    const request = makeRequest("http://localhost:3000/organizatie-suspendata", {
      host: "localhost:3000",
    });

    const response = await updateSession(request);

    expect(response.status).not.toBe(307);
  });
});
