import { describe, expect, it } from "vitest";
import { fuzzyFilter, fuzzyMatches, normalizeText, searchTokens } from "./fuzzy-match";

describe("fuzzy-match", () => {
  it("normalizeaza diacritice, majuscule, punctuatie si S.R.L.", () => {
    expect(normalizeText("SC Pietriș-Bălan S.R.L.")).toBe("sc pietris balan srl");
  });

  it("ignora forma juridica", () => {
    expect(searchTokens("Beton SRL")).toEqual(["beton"]);
  });

  it("gaseste clientul indiferent de forma juridica si diacritice", () => {
    expect(fuzzyMatches("SC BETON S.R.L.", "Beton SRL")).toBe(true);
    expect(fuzzyMatches("Construcții Ploiești SA", "constructii ploiesti")).toBe(true);
  });

  it("cere toate cuvintele, in orice ordine", () => {
    expect(fuzzyMatches("Nisip spălat 0-4", "0 4 nisip")).toBe(true);
    expect(fuzzyMatches("Nisip spălat 0-4", "nisip 8")).toBe(false);
  });

  it("o cautare doar din forma juridica potriveste tot", () => {
    expect(fuzzyMatches("orice", "SRL")).toBe(true);
  });

  it("filtreaza o lista", () => {
    const rows = [{ t: "Pietriș 4-8" }, { t: "Nisip" }];
    expect(fuzzyFilter(rows, "pietris", (row) => row.t)).toEqual([{ t: "Pietriș 4-8" }]);
  });
});
