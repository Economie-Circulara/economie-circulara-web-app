import { describe, expect, it } from "vitest";
import {
  addLine,
  linesFromOrder,
  removeLine,
  setQuantity,
  totalLines,
  totalQuantity,
} from "./cart-logic";
import type { CartLine } from "./types";

function line(overrides: Partial<CartLine> = {}): CartLine {
  return { itemId: "item-1", itemTitle: "Cărămidă eco", unit: "bucata", quantity: 1, ...overrides };
}

describe("addLine", () => {
  it("adauga un item nou intr-un cos gol", () => {
    const result = addLine([], line());
    expect(result).toEqual([line()]);
  });

  it("incrementeaza cantitatea daca itemul e deja in cos", () => {
    const result = addLine([line({ quantity: 2 })], line({ quantity: 3 }));
    expect(result).toEqual([line({ quantity: 5 })]);
  });

  it("nu modifica alte linii existente", () => {
    const other = line({ itemId: "item-2", itemTitle: "Nisip reciclat", quantity: 4 });
    const result = addLine([other], line({ quantity: 1 }));
    expect(result).toEqual([other, line({ quantity: 1 })]);
  });
});

describe("removeLine", () => {
  it("scoate itemul cerut", () => {
    const other = line({ itemId: "item-2" });
    const result = removeLine([line(), other], "item-1");
    expect(result).toEqual([other]);
  });

  it("nu arunca daca itemul nu exista in cos", () => {
    expect(removeLine([line()], "item-x")).toEqual([line()]);
  });
});

describe("setQuantity", () => {
  it("actualizeaza cantitatea unei linii existente", () => {
    const result = setQuantity([line({ quantity: 1 })], "item-1", 7);
    expect(result).toEqual([line({ quantity: 7 })]);
  });

  it("scoate linia din cos daca noua cantitate e 0", () => {
    expect(setQuantity([line()], "item-1", 0)).toEqual([]);
  });

  it("scoate linia din cos daca noua cantitate e negativa", () => {
    expect(setQuantity([line()], "item-1", -2)).toEqual([]);
  });
});

describe("totalLines / totalQuantity", () => {
  it("numara liniile distincte si suma cantitatilor", () => {
    const lines = [line({ quantity: 3 }), line({ itemId: "item-2", quantity: 2 })];
    expect(totalLines(lines)).toBe(2);
    expect(totalQuantity(lines)).toBe(5);
  });

  it("intoarce 0 pentru un cos gol", () => {
    expect(totalLines([])).toBe(0);
    expect(totalQuantity([])).toBe(0);
  });
});

describe("linesFromOrder (repeta comanda)", () => {
  it("mapeaza liniile unei comenzi vechi in linii de cos", () => {
    const result = linesFromOrder([
      {
        id: "oi-1",
        orderId: "order-1",
        itemId: "item-1",
        itemTitle: "Cărămidă eco",
        unit: "bucata",
        quantity: 4000,
      },
      {
        id: "oi-2",
        orderId: "order-1",
        itemId: "item-2",
        itemTitle: "Pavaj",
        unit: "mc",
        quantity: 12,
      },
    ]);

    expect(result).toEqual([
      { itemId: "item-1", itemTitle: "Cărămidă eco", unit: "bucata", quantity: 4000 },
      { itemId: "item-2", itemTitle: "Pavaj", unit: "mc", quantity: 12 },
    ]);
  });

  it("intoarce cos gol pentru o comanda fara linii", () => {
    expect(linesFromOrder([])).toEqual([]);
  });
});
