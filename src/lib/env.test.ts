import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSupabaseEnv } from "./env";

describe("getSupabaseEnv", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("returneaza url + publishableKey cand sunt setate", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";

    expect(getSupabaseEnv()).toEqual({
      url: "http://localhost:54321",
      publishableKey: "sb_publishable_test",
    });
  });

  it("arunca eroare cu numele variabilei lipsa (URL)", () => {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    expect(() => getSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("arunca eroare cu numele variabilei lipsa (publishable key)", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    expect(() => getSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);
  });
});
