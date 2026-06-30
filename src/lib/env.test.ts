import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getSupabaseEnv } from "./env";

describe("getSupabaseEnv", () => {
  const original = { ...process.env };

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    process.env = { ...original };
  });

  it("returneaza url + anonKey cand sunt setate", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    expect(getSupabaseEnv()).toEqual({
      url: "http://localhost:54321",
      anonKey: "anon-key",
    });
  });

  it("arunca eroare cu numele variabilei lipsa (URL)", () => {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    expect(() => getSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("arunca eroare cu numele variabilei lipsa (anon key)", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    expect(() => getSupabaseEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
  });
});
