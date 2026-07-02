import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TENANT_DOMAIN_HEADER, TENANT_SLUG_HEADER } from "@/features/auth/tenant";

// `vi.mock` este ridicat (hoisted) deasupra importurilor, deci definim mock-urile cu
// `vi.hoisted` ca sa fie disponibile in factory.
const { getUser, createServerClient } = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerClient: vi.fn(),
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
  createServerClient.mockReturnValue({
    auth: { getUser },
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
