import { describe, expect, it } from "vitest";
import { normalizeHost, resolveTenant } from "./tenant";

const ROOT = "lotculot.eu";

describe("normalizeHost", () => {
  it("elimina portul si forteaza lowercase", () => {
    expect(normalizeHost("ACME.LotCuLot.EU:3000")).toBe("acme.lotculot.eu");
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
    const t = resolveTenant("acme.lotculot.eu", "/", ROOT);
    expect(t).toEqual({ slug: "acme", customDomain: null, source: "subdomain" });
  });
  it("subdomenii rezervate (www/app) cad pe path", () => {
    expect(resolveTenant("www.lotculot.eu", "/beta/comenzi", ROOT).source).toBe("path");
    expect(resolveTenant("app.lotculot.eu", "/", ROOT).source).toBe("none");
  });
  it("root domain gol => fara tenant din host", () => {
    expect(resolveTenant("lotculot.eu", "/", ROOT)).toEqual({
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
  it("segmente rezervate de rute aplicatie (dashboard/portal/platform/showcase/set-password/forgot-password) nu sunt tenant", () => {
    expect(resolveTenant("localhost", "/dashboard", ROOT).source).toBe("none");
    expect(resolveTenant("localhost", "/portal/comenzi", ROOT).source).toBe("none");
    expect(resolveTenant("localhost", "/platform", ROOT).source).toBe("none");
    expect(resolveTenant("localhost", "/showcase", ROOT).source).toBe("none");
    expect(resolveTenant("localhost", "/set-password", ROOT).source).toBe("none");
    expect(resolveTenant("localhost", "/forgot-password", ROOT).source).toBe("none");
  });
  it("slug invalid (majuscule/underscore) => none", () => {
    expect(resolveTenant("localhost", "/Acme_Org", ROOT).source).toBe("none");
  });
  it("path gol => none", () => {
    expect(resolveTenant("localhost", "/", ROOT).slug).toBeNull();
  });
});
