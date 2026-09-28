import { describe, expect, it } from "vitest";
import { orgBrandColors, themeAllowsOrgColors } from "./brand-colors";

const colors = { primaryColor: "#123456", secondaryColor: "#abcdef" };

describe("orgBrandColors", () => {
  it("pe tema implicita aplica culorile din Setari", () => {
    expect(orgBrandColors({ theme: "default", ...colors })).toEqual({
      brand: "#123456",
      accent: "#abcdef",
    });
    // tema lipsa/necunoscuta = implicita
    expect(orgBrandColors({ theme: null, ...colors }).brand).toBe("#123456");
  });

  it("pe o tema aleasa de platforma culorile din Setari NU suprascriu tema", () => {
    expect(orgBrandColors({ theme: "industrial", ...colors })).toEqual({});
    expect(themeAllowsOrgColors("teren")).toBe(false);
  });

  it("fara organizatie sau fara culori -> nimic de suprascris", () => {
    expect(orgBrandColors(null)).toEqual({});
    expect(orgBrandColors({ theme: "default", primaryColor: " ", secondaryColor: null })).toEqual({
      brand: undefined,
      accent: undefined,
    });
  });
});
