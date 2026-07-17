import { describe, expect, it } from "vitest";
import {
  computeIdealOutput,
  computeLoss,
  computeRequiredConsumption,
  distributeByPercentage,
  roundQty,
  sumQty,
} from "./calc";
import type { RecipeComponent } from "@/features/recipes/types";

function component(overrides: Partial<RecipeComponent> = {}): RecipeComponent {
  return {
    id: "comp-1",
    componentItemId: "item-a",
    componentItemTitle: "Ciment",
    unit: "kg",
    percentage: 20,
    ...overrides,
  };
}

describe("distributeByPercentage", () => {
  const components: RecipeComponent[] = [
    component({ componentItemId: "item-a", componentItemTitle: "Ciment", percentage: 20 }),
    component({ componentItemId: "item-b", componentItemTitle: "Nisip", percentage: 50 }),
    component({ componentItemId: "item-c", componentItemTitle: "Pietriș", percentage: 30 }),
  ];

  it("distribuie cantitatea totala proportional cu procentele (4a: consum calculat)", () => {
    expect(distributeByPercentage(components, 1000)).toEqual([
      { itemId: "item-a", itemTitle: "Ciment", unit: "kg", percentage: 20, qty: 200 },
      { itemId: "item-b", itemTitle: "Nisip", unit: "kg", percentage: 50, qty: 500 },
      { itemId: "item-c", itemTitle: "Pietriș", unit: "kg", percentage: 30, qty: 300 },
    ]);
  });

  it("aceeasi functie serveste si output-ul ideal (4b), aplicata pe cantitatea de input", () => {
    const ideal = computeIdealOutput(components, 500);
    expect(ideal.map((l) => l.qty)).toEqual([100, 250, 150]);
    expect(sumQty(ideal)).toBe(500);
  });

  it("computeRequiredConsumption e alias-ul folosit pentru 4a", () => {
    expect(computeRequiredConsumption).toBe(distributeByPercentage);
  });

  it("rotunjeste la 3 zecimale", () => {
    const result = distributeByPercentage([component({ percentage: 33.333 })], 100);
    expect(result[0].qty).toBe(33.333);
  });

  it("arunca eroare pentru o cantitate totala invalida (<= 0)", () => {
    expect(() => distributeByPercentage(components, 0)).toThrow("mai mare ca zero");
    expect(() => distributeByPercentage(components, -5)).toThrow("mai mare ca zero");
  });

  it("returneaza o lista goala pentru o reteta fara componente", () => {
    expect(distributeByPercentage([], 100)).toEqual([]);
  });
});

describe("sumQty", () => {
  it("insumeaza cantitatile, rotunjit", () => {
    expect(sumQty([{ qty: 1.1111 }, { qty: 2.2222 }])).toBe(3.333);
  });

  it("returneaza 0 pentru o lista goala", () => {
    expect(sumQty([])).toBe(0);
  });
});

describe("computeLoss (randament/pierderi — informativ, nevalidat)", () => {
  it("calculeaza diferenta input - output (pierdere pozitiva la reciclare)", () => {
    expect(computeLoss(500, 470)).toBe(30);
  });

  it("nu blocheaza/arunca daca output > input (doar raporteaza valoarea negativa)", () => {
    expect(computeLoss(100, 120)).toBe(-20);
  });

  it("randament perfect (fara pierderi)", () => {
    expect(computeLoss(300, 300)).toBe(0);
  });
});

describe("roundQty", () => {
  it("rotunjeste la 3 zecimale, consistent cu numeric(14,3) din schema", () => {
    expect(roundQty(1.23456)).toBe(1.235);
    expect(roundQty(10)).toBe(10);
  });
});
