import { describe, expect, it } from "vitest";
import { inlineLogoOf, squareLogoOf } from "./logos";

const both = { logoUrl: "https://x/inline.png", logoSquareUrl: "https://x/square.png" };

describe("alegerea variantei de logo", () => {
  it("cu ambele variante: orizontal pt. spatii late, patrat pt. favicon", () => {
    expect(inlineLogoOf(both)).toBe("https://x/inline.png");
    expect(squareLogoOf(both)).toBe("https://x/square.png");
  });

  it("doar varianta patrata: e folosita peste tot", () => {
    const org = { logoUrl: null, logoSquareUrl: "https://x/square.png" };
    expect(inlineLogoOf(org)).toBe("https://x/square.png");
    expect(squareLogoOf(org)).toBe("https://x/square.png");
  });

  it("doar varianta orizontala: e folosita peste tot", () => {
    const org = { logoUrl: "https://x/inline.png", logoSquareUrl: null };
    expect(inlineLogoOf(org)).toBe("https://x/inline.png");
    expect(squareLogoOf(org)).toBe("https://x/inline.png");
  });

  it("fara logo / fara organizatie: undefined", () => {
    expect(inlineLogoOf({ logoUrl: "", logoSquareUrl: null })).toBeUndefined();
    expect(squareLogoOf(null)).toBeUndefined();
  });
});
