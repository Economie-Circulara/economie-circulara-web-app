import { describe, expect, it } from "vitest";
import { isValidSlug, slugify } from "./slug";

describe("isValidSlug", () => {
  it.each(["acme", "acme-recycling", "a1", "123", "a-b-c", "ab12-cd"])(
    "accepta slug valid: %s",
    (slug) => {
      expect(isValidSlug(slug)).toBe(true);
    },
  );

  it.each([
    "",
    "-acme",
    "acme-",
    "Acme",
    "acme_recycling",
    "acme recycling",
    "acme--", // se termina cu cratima
    "a b",
    "ăcme", // diacritice
    "acme.ro",
  ])("respinge slug invalid: %s", (slug) => {
    expect(isValidSlug(slug)).toBe(false);
  });
});

describe("slugify", () => {
  it("normalizeaza numele organizatiei intr-un slug valid", () => {
    const suggestion = slugify("Acme Recycling SRL");
    expect(suggestion).toBe("acme-recycling-srl");
    expect(isValidSlug(suggestion)).toBe(true);
  });

  it("elimina diacriticele romanesti", () => {
    expect(slugify("Reciclare Ștefănești")).toBe("reciclare-stefanesti");
  });

  it("elimina cratimele de la inceput/sfarsit rezultate din caractere speciale", () => {
    expect(slugify("  -- Acme! --  ")).toBe("acme");
  });
});
