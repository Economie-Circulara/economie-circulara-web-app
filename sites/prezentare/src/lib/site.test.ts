import { describe, expect, it } from "vitest";
import { selectTenant } from "./site";
import { appLoginUrl, telHref } from "./links";

describe("selectTenant", () => {
  const tenants = ["etora", "maconxcx"];

  it("accepta un tenant existent (fara spatii, litere mici)", () => {
    expect(selectTenant(" Etora ", tenants)).toBe("etora");
  });

  it("lipsa sau necunoscut -> eroare cu valorile posibile", () => {
    expect(() => selectTenant(undefined, tenants)).toThrow(/nu e setat.*etora, maconxcx/);
    expect(() => selectTenant("altul", tenants)).toThrow(/content\/altul\.json/);
    expect(() => selectTenant("../etora", tenants)).toThrow();
  });
});

describe("links", () => {
  it("login pe domeniul aplicatiei", () => {
    expect(appLoginUrl("circular.etora.ro")).toBe("https://circular.etora.ro/login");
  });

  it("tel: fara separatori", () => {
    expect(telHref("+40 722.123-456")).toBe("tel:+40722123456");
  });
});
