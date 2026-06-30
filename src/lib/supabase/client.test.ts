import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// `vi.mock` este ridicat (hoisted) deasupra importurilor, deci definim mock-ul cu
// `vi.hoisted` ca sa fie disponibil in factory.
const { createBrowserClient } = vi.hoisted(() => ({
  createBrowserClient: vi.fn(() => ({ sentinel: "browser-client" })),
}));

// Mock complet al @supabase/ssr (nu atingem libraria reala).
vi.mock("@supabase/ssr", () => ({ createBrowserClient }));

import { createClient } from "./client";

describe("createClient (browser)", () => {
  const original = { ...process.env };

  beforeEach(() => {
    createBrowserClient.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("creeaza clientul cu url + publishable key din env", () => {
    const client = createClient();

    expect(createBrowserClient).toHaveBeenCalledTimes(1);
    expect(createBrowserClient).toHaveBeenCalledWith(
      "http://localhost:54321",
      "sb_publishable_test",
    );
    expect(client).toEqual({ sentinel: "browser-client" });
  });

  it("propaga eroarea cand lipseste configul Supabase", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(createBrowserClient).not.toHaveBeenCalled();
  });
});
