import { describe, expect, it } from "vitest";
import { normalizeHost, resolveTenant, tenantDomainRedirect } from "./tenant";

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

describe("tenantDomainRedirect", () => {
  const platform = { siteUrl: "https://www.lotculot.eu", rootDomain: ROOT };
  const orgA = { customDomain: "trace.firma-a.ro" };
  const orgFaraDomeniu = { customDomain: null };
  const redirect = (host: string, organization: { customDomain: string | null } | null) =>
    tenantDomainRedirect({ host, organization, platform });

  it("trimite userul pe domeniul organizatiei cand e pe alt domeniu", () => {
    expect(redirect("trace.firma-b.ro", orgA)).toBe("trace.firma-a.ro");
    expect(redirect("www.lotculot.eu", orgA)).toBe("trace.firma-a.ro");
  });

  it("nu redirectioneaza pe domeniul corect (case/port ignorate)", () => {
    expect(redirect("Trace.Firma-A.ro:443", orgA)).toBeNull();
  });

  it("organizatia fara domeniu propriu e trimisa de pe domeniul altui tenant pe platforma", () => {
    expect(redirect("trace.firma-b.ro", orgFaraDomeniu)).toBe("www.lotculot.eu");
  });

  it("organizatia fara domeniu propriu lucreaza pe domeniile platformei", () => {
    expect(redirect("www.lotculot.eu", orgFaraDomeniu)).toBeNull();
    expect(redirect("lotculot.eu", orgFaraDomeniu)).toBeNull();
    expect(redirect("acme.lotculot.eu", orgFaraDomeniu)).toBeNull();
  });

  it("fara root domain, doar originea canonica e a platformei", () => {
    const only = { siteUrl: "https://www.lotculot.eu" };
    expect(
      tenantDomainRedirect({
        host: "www.lotculot.eu",
        organization: orgFaraDomeniu,
        platform: only,
      }),
    ).toBeNull();
    expect(
      tenantDomainRedirect({
        host: "trace.firma-b.ro",
        organization: orgFaraDomeniu,
        platform: only,
      }),
    ).toBe("www.lotculot.eu");
  });

  it("fara domeniul platformei configurat nu redirectioneaza organizatia fara domeniu", () => {
    expect(
      tenantDomainRedirect({
        host: "trace.firma-b.ro",
        organization: orgFaraDomeniu,
        platform: {},
      }),
    ).toBeNull();
  });

  it("super-adminul (fara organizatie) lucreaza pe orice domeniu", () => {
    expect(redirect("trace.firma-b.ro", null)).toBeNull();
  });

  it("nu se aplica pe dev, e2e si preview-uri Vercel", () => {
    for (const org of [orgA, orgFaraDomeniu]) {
      expect(redirect("localhost:3000", org)).toBeNull();
      expect(redirect("127.0.0.1:3000", org)).toBeNull();
      expect(redirect("acme.localhost:3000", org)).toBeNull();
      expect(redirect("app-git-x.vercel.app", org)).toBeNull();
    }
  });
});
