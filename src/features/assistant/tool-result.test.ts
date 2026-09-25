import { describe, expect, it } from "vitest";
import { serializeToolResult } from "./tool-result";

describe("serializeToolResult", () => {
  it("lasa neschimbat un rezultat care incape", () => {
    expect(serializeToolResult({ gasit: 2 }, 100)).toBe('{"gasit":2}');
  });

  it("scurteaza o lista de la coada, ramane JSON valid si spune cate s-au afisat", () => {
    const rows = Array.from({ length: 200 }, (_, index) => ({
      id: `item-${index}`,
      denumire: "x",
    }));
    const out = serializeToolResult(rows, 1000);

    expect(out.length).toBeLessThanOrEqual(1000);
    const parsed = JSON.parse(out);
    expect(parsed.trunchiat).toBe(true);
    expect(parsed.total).toBe(200);
    expect(parsed.afisate).toBe(parsed.rezultate.length);
    expect(parsed.rezultate.length).toBeGreaterThan(0);
    expect(parsed.rezultate[0]).toEqual({ id: "item-0", denumire: "x" });
  });

  it("un obiect prea lung devine JSON valid cu textul scurtat", () => {
    const out = serializeToolResult({ text: 'a"b\\c'.repeat(2000) }, 500);

    expect(out.length).toBeLessThanOrEqual(500);
    const parsed = JSON.parse(out);
    expect(parsed.trunchiat).toBe(true);
    expect(typeof parsed.continut).toBe("string");
  });

  it("serializeaza `undefined` ca null (JSON valid)", () => {
    expect(serializeToolResult(undefined)).toBe("null");
  });
});
