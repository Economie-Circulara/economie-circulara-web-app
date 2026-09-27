import { describe, expect, it } from "vitest";
import { normalizeCustomDomain } from "./domain";

describe("normalizeCustomDomain", () => {
  it("pastreaza doar hostul, lowercase", () => {
    expect(normalizeCustomDomain(" https://App.Etora.ro/ ")).toEqual({
      ok: true,
      value: "app.etora.ro",
    });
    expect(normalizeCustomDomain("app.maconxcx.ro")).toEqual({
      ok: true,
      value: "app.maconxcx.ro",
    });
  });

  it("gol -> fara domeniu propriu", () => {
    expect(normalizeCustomDomain("  ")).toEqual({ ok: true, value: null });
    expect(normalizeCustomDomain(null)).toEqual({ ok: true, value: null });
  });

  it("respinge cai, porturi si hosturi invalide", () => {
    expect(normalizeCustomDomain("app.etora.ro/login").ok).toBe(false);
    expect(normalizeCustomDomain("app.etora.ro:3000").ok).toBe(false);
    expect(normalizeCustomDomain("localhost").ok).toBe(false);
    expect(normalizeCustomDomain("-app.etora.ro").ok).toBe(false);
  });
});
