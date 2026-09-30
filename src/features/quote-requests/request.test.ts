import { describe, expect, it } from "vitest";
import { isAllowedOrigin, normalizeHost, parseQuoteRequest, siteOriginsFor } from "./request";

const valid = {
  service: "Beton",
  name: " Ion Pop ",
  phone: "0722 123 456",
  email: "",
  message: "20 mc, Iași",
  consent: true,
  website: "",
};

describe("parseQuoteRequest", () => {
  it("accepta o cerere completa si normalizeaza campurile", () => {
    expect(parseQuoteRequest(valid)).toEqual({
      kind: "ok",
      value: {
        service: "Beton",
        name: "Ion Pop",
        phone: "0722 123 456",
        email: null,
        message: "20 mc, Iași",
      },
    });
  });

  it("recunoaste botul dupa campul-capcana", () => {
    expect(parseQuoteRequest({ ...valid, website: "http://spam" })).toEqual({ kind: "bot" });
  });

  it.each([
    ["fara nume", { name: "  " }],
    ["fara telefon", { phone: "" }],
    ["fara serviciu", { service: undefined }],
    ["fara acord", { consent: false }],
    ["acord ca text", { consent: "true" }],
    ["telefon invalid", { phone: "abc" }],
    ["email invalid", { email: "nu-e-email" }],
    ["mesaj prea lung", { message: "a".repeat(2001) }],
  ])("respinge cererea %s", (_label, patch) => {
    expect(parseQuoteRequest({ ...valid, ...patch }).kind).toBe("invalid");
  });

  it("respinge un corp care nu e obiect", () => {
    expect(parseQuoteRequest(null).kind).toBe("invalid");
    expect(parseQuoteRequest([valid]).kind).toBe("invalid");
  });

  it("pastreaza emailul valid", () => {
    const parsed = parseQuoteRequest({ ...valid, email: "ion@exemplu.ro" });
    expect(parsed.kind === "ok" && parsed.value.email).toBe("ion@exemplu.ro");
  });
});

describe("originile site-ului", () => {
  it("deriva apex-ul si www din domeniul aplicatiei", () => {
    expect(siteOriginsFor("abonamente.maconxcx.ro")).toEqual([
      "https://maconxcx.ro",
      "https://www.maconxcx.ro",
    ]);
    expect(siteOriginsFor("maconxcx.ro")).toEqual([]);
  });

  it("accepta doar originile site-ului organizatiei", () => {
    expect(isAllowedOrigin("https://maconxcx.ro", "abonamente.maconxcx.ro", false)).toBe(true);
    expect(isAllowedOrigin("https://www.maconxcx.ro", "abonamente.maconxcx.ro", false)).toBe(true);
    expect(isAllowedOrigin("https://etora.ro", "abonamente.maconxcx.ro", false)).toBe(false);
    expect(isAllowedOrigin("http://maconxcx.ro", "abonamente.maconxcx.ro", false)).toBe(false);
    expect(isAllowedOrigin(null, "abonamente.maconxcx.ro", false)).toBe(false);
  });

  it("accepta localhost doar in afara productiei", () => {
    expect(isAllowedOrigin("http://localhost:3001", "abonamente.maconxcx.ro", true)).toBe(true);
    expect(isAllowedOrigin("http://localhost:3001", "abonamente.maconxcx.ro", false)).toBe(false);
  });

  it("normalizeaza hostul", () => {
    expect(normalizeHost("Abonamente.MaconXCX.ro:443")).toBe("abonamente.maconxcx.ro");
    expect(normalizeHost("")).toBeNull();
    expect(normalizeHost(null)).toBeNull();
  });
});
