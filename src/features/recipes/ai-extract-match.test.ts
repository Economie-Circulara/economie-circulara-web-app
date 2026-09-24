import { describe, expect, it } from "vitest";
import { matchComponents, normalizeName, similarity } from "./ai-extract-match";

describe("normalizeName", () => {
  it("elimina diacriticele romanesti si normalizeaza spatiile/majusculele", () => {
    expect(normalizeName("Ciment CEM-II  42,5")).toBe("ciment cem ii 42 5");
    expect(normalizeName("Apă")).toBe("apa");
    expect(normalizeName("Nisip Sortat")).toBe("nisip sortat");
    expect(normalizeName("Pietriș")).toBe("pietris");
    expect(normalizeName("Țeavă")).toBe("teava");
  });
});

describe("similarity", () => {
  it("intoarce 1 pentru siruri identice", () => {
    expect(similarity("ciment", "ciment")).toBe(1);
  });

  it("intoarce un scor mare pentru substring (nume mai detaliat)", () => {
    expect(similarity("ciment", "ciment cem ii 42 5")).toBeGreaterThan(0.85);
  });

  it("intoarce un scor mic pentru siruri fara legatura", () => {
    expect(similarity("ciment", "pietris sortat")).toBeLessThan(0.4);
  });

  it("e simetrica", () => {
    expect(similarity("apa", "apa potabila")).toBeCloseTo(similarity("apa potabila", "apa"));
  });
});

describe("matchComponents", () => {
  const candidates = [
    { id: "item-ciment", title: "Ciment CEM II 42.5", unit: "kg" },
    { id: "item-apa", title: "Apă", unit: "l" },
    { id: "item-nisip", title: "Nisip sortat 0-4mm", unit: "kg" },
  ];

  it("potriveste un nume exact", () => {
    const [result] = matchComponents([{ name: "Apă", quantity: 200, unit: "kg" }], candidates);
    expect(result.itemId).toBe("item-apa");
    expect(result.confidence).toBe(1);
  });

  it("potriveste un nume aproximativ (scriere diferita, fara diacritice)", () => {
    const [result] = matchComponents([{ name: "ciment", quantity: 150, unit: "kg" }], candidates);
    expect(result.itemId).toBe("item-ciment");
    expect(result.confidence).toBeGreaterThanOrEqual(0.6);
  });

  it("nu potriveste un nume fara corespondent (sub prag) - lasa itemId null", () => {
    const [result] = matchComponents(
      [{ name: "Aditiv plastifiant special XYZ", quantity: 5, unit: "kg" }],
      candidates,
    );
    expect(result.itemId).toBeNull();
    expect(result.itemTitle).toBeNull();
  });

  it("pastreaza componenta extrasa originala in rezultat, indiferent de potrivire", () => {
    const [result] = matchComponents([{ name: "Nisip", quantity: 650, unit: "kg" }], candidates);
    expect(result.extracted).toEqual({ name: "Nisip", quantity: 650, unit: "kg" });
  });

  it("functioneaza fara niciun candidat (organizatie fara materiale)", () => {
    const [result] = matchComponents([{ name: "Ciment", quantity: 10, unit: "kg" }], []);
    expect(result.itemId).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it("potriveste fiecare componenta independent, pastrand ordinea", () => {
    const results = matchComponents(
      [
        { name: "Ciment", quantity: 150, unit: "kg" },
        { name: "Necunoscut total", quantity: 10, unit: "kg" },
        { name: "Nisip sortat", quantity: 650, unit: "kg" },
      ],
      candidates,
    );
    expect(results.map((r) => r.itemId)).toEqual(["item-ciment", null, "item-nisip"]);
  });

  it("respecta un prag custom", () => {
    const [permisiv] = matchComponents(
      [{ name: "cimen", quantity: 1, unit: "kg" }],
      candidates,
      0.1,
    );
    expect(permisiv.itemId).not.toBeNull();

    const [strict] = matchComponents(
      [{ name: "cimen", quantity: 1, unit: "kg" }],
      candidates,
      0.99,
    );
    expect(strict.itemId).toBeNull();
  });
});
