import { describe, expect, it } from "vitest";
import { normalizeHost, resolveTenant } from "./tenant";

const ROOT = "lateristrace.app";

describe("normalizeHost", () => {
  it("elimina portul si forteaza lowercase", () => {
    expect(normalizeHost("ACME.Lateristrace.App:3000")).toBe("acme.lateristrace.app");
  });
  it("trateaza null/undefined ca string gol", () => {
    expect(normalizeHost(null)).toBe("");
    expect(normalizeHost(undefined)).toBe("");
  });
});

describe("resolveTenant - custom domain", () => {
  it("host strain de root domain => custom_domain", () => {
    const t = resolveTenant("trace.acme.ro", "/comenzi", ROOT);
    expect(t).toEqual({ slug: null, customDomain: "trace.acme.ro", source: "custom_domain" });
  });
});

describe("resolveTenant - subdomeniu", () => {
  it("<slug>.<root> => subdomain", () => {
    const t = resolveTenant("acme.lateristrace.app", "/", ROOT);
    expect(t).toEqual({ slug: "acme", customDomain: null, source: "subdomain" });
  });
  it("subdomenii rezervate (www/app) cad pe path", () => {
    expect(resolveTenant("www.lateristrace.app", "/beta/comenzi", ROOT).source).toBe("path");
    expect(resolveTenant("app.lateristrace.app", "/", ROOT).source).toBe("none");
  });
  it("root domain gol => fara tenant din host", () => {
    expect(resolveTenant("lateristrace.app", "/", ROOT)).toEqual({
      slug: null,
      customDomain: null,
      source: "none",
    });
  });
});

describe("resolveTenant - path (dev / fara root domain)", () => {
  it("localhost cade pe primul segment de path", () => {
    const t = resolveTenant("localhost:3000", "/acme/comenzi", ROOT);
    expect(t).toEqual({ slug: "acme", customDomain: null, source: "path" });
  });
  it("fara root domain configurat => mereu pe path", () => {
    const t = resolveTenant("oricehost.com", "/acme", undefined);
    expect(t.slug).toBe("acme");
    expect(t.source).toBe("path");
  });
  it("segmente rezervate (auth/api) nu sunt tenant", () => {
    expect(resolveTenant("localhost", "/auth/login", ROOT).source).toBe("none");
    expect(resolveTenant("localhost", "/api/x", ROOT).source).toBe("none");
  });
  it("slug invalid (majuscule/underscore) => none", () => {
    expect(resolveTenant("localhost", "/Acme_Org", ROOT).source).toBe("none");
  });
  it("path gol => none", () => {
    expect(resolveTenant("localhost", "/", ROOT).slug).toBeNull();
  });
});
