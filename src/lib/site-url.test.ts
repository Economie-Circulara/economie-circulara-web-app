import { describe, expect, it } from "vitest";
import { orgOrigin, resolveSiteOrigin } from "./site-url";

describe("resolveSiteOrigin", () => {
  it("foloseste URL-ul canonic configurat in locul hostului cererii", () => {
    expect(
      resolveSiteOrigin({
        configuredUrl: "https://www.lotculot.eu/tenant/login?from=preview",
        forwardedProto: "https",
        host: "acme.lotculot.eu",
      }),
    ).toBe("https://www.lotculot.eu");
  });

  it("foloseste hostul cererii ca fallback pentru dezvoltare si preview", () => {
    expect(
      resolveSiteOrigin({
        configuredUrl: "",
        forwardedProto: "https, http",
        host: "preview.example.test",
      }),
    ).toBe("https://preview.example.test");
  });

  it("cade pe localhost cand nu exista configurare sau headere", () => {
    expect(resolveSiteOrigin({})).toBe("http://localhost:3000");
  });

  it("respinge protocoale care nu pot fi folosite pentru callback-uri web", () => {
    expect(() => resolveSiteOrigin({ configuredUrl: "javascript:alert(1)" })).toThrow(/http/i);
  });
});

describe("orgOrigin", () => {
  it("foloseste domeniul propriu al organizatiei, mereu pe https", () => {
    expect(orgOrigin(" Trace.Acme.ro ", "https://www.lotculot.eu")).toBe("https://trace.acme.ro");
  });

  it("cade pe originea canonica cand organizatia nu are domeniu", () => {
    expect(orgOrigin(null, "https://www.lotculot.eu")).toBe("https://www.lotculot.eu");
    expect(orgOrigin("  ", "https://www.lotculot.eu")).toBe("https://www.lotculot.eu");
  });
});
