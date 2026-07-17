import { describe, expect, it } from "vitest";
import { stockEventsToCsv } from "./csv";
import type { StockEvent } from "./types";

function event(overrides: Partial<StockEvent> = {}): StockEvent {
  return {
    id: "ev-1",
    itemId: "item-1",
    itemTitle: "Ciment Portland",
    lotId: "11111111-2222-3333-4444-555555555555",
    eventType: "intake",
    quantity: 100,
    reason: null,
    orderId: null,
    processId: null,
    createdBy: "user-1",
    createdByName: "Ana Pop",
    createdAt: "2026-07-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("stockEventsToCsv", () => {
  it("include header-ul in romana ca prim rand", () => {
    const csv = stockEventsToCsv([]);
    const [header] = csv.replace(/^\uFEFF/, "").split("\r\n");
    expect(header).toBe("Data,Tip eveniment,Item,Lot,Cantitate,Motiv,Comanda,Proces,Utilizator");
  });

  it("incepe cu BOM UTF-8 (compatibilitate Excel cu diacritice)", () => {
    const csv = stockEventsToCsv([]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("mapeaza un eveniment de intrare la un rand CSV corect", () => {
    const csv = stockEventsToCsv([event()]);
    const rows = csv
      .replace(/^\uFEFF/, "")
      .trim()
      .split("\r\n");

    expect(rows).toHaveLength(2);
    expect(rows[1]).toBe(
      "2026-07-01T10:00:00.000Z,Intrare,Ciment Portland,11111111,100,,,,Ana Pop",
    );
  });

  it("scapa campurile ce contin virgula sau ghilimele (RFC 4180)", () => {
    const csv = stockEventsToCsv([event({ reason: 'Contine, virgula si "ghilimele"' })]);
    const [, row] = csv
      .replace(/^\uFEFF/, "")
      .trim()
      .split("\r\n");

    expect(row).toContain('"Contine, virgula si ""ghilimele"""');
  });

  it("afiseaza liniuta pentru lot lipsa (eveniment fara lot asociat)", () => {
    const csv = stockEventsToCsv([event({ lotId: null })]);
    const [, row] = csv
      .replace(/^\uFEFF/, "")
      .trim()
      .split("\r\n");

    expect(row.split(",")[3]).toBe("—");
  });

  it("foloseste eticheta romaneasca pentru tipul evenimentului", () => {
    const csv = stockEventsToCsv([event({ eventType: "consumption", quantity: -30 })]);
    const [, row] = csv
      .replace(/^\uFEFF/, "")
      .trim()
      .split("\r\n");

    expect(row).toContain("Consum");
    expect(row).toContain("-30");
  });
});
