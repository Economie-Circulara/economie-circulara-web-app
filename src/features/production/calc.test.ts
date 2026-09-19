import { describe, expect, it } from "vitest";
import {
  computeIdealOutput,
  computeLoss,
  computeRequiredConsumption,
  distributeByPercentage,
  roundQty,
  sumQty,
  sumQtyInRecipeUnit,
  toRecipeUnit,
} from "./calc";
import type { RecipeComponent } from "@/features/recipes/types";

function component(overrides: Partial<RecipeComponent> = {}): RecipeComponent {
  return {
    id: "comp-1",
    componentItemId: "item-a",
    componentItemTitle: "Ciment",
    unit: "kg",
    percentage: 20,
    conversionFactor: 1,
    isTracked: true,
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
      {
        itemId: "item-a",
        itemTitle: "Ciment",
        unit: "kg",
        percentage: 20,
        conversionFactor: 1,
        qty: 200,
        qtyInRecipeUnit: 200,
        isTracked: true,
      },
      {
        itemId: "item-b",
        itemTitle: "Nisip",
        unit: "kg",
        percentage: 50,
        conversionFactor: 1,
        qty: 500,
        qtyInRecipeUnit: 500,
        isTracked: true,
      },
      {
        itemId: "item-c",
        itemTitle: "Pietriș",
        unit: "kg",
        percentage: 30,
        conversionFactor: 1,
        qty: 300,
        qtyInRecipeUnit: 300,
        isTracked: true,
      },
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

describe("distributeByPercentage - conversii de UM (migrarea 0028)", () => {
  // Reteta de beton exprimata in kg (UM-ul itemului retetei), cu componente in
  // UM-uri diferite - cazul din bug-ul raportat: inainte, 1 mc era tratat ca 1 kg.
  const beton: RecipeComponent[] = [
    component({
      componentItemId: "nisip",
      componentItemTitle: "Nisip",
      unit: "mc",
      percentage: 30,
      conversionFactor: 1500, // 1 mc nisip ≈ 1500 kg
    }),
    component({
      componentItemId: "apa",
      componentItemTitle: "Apă",
      unit: "litru",
      percentage: 7.5,
      conversionFactor: 1, // 1 litru apa ≈ 1 kg
      isTracked: false,
    }),
  ];

  it("imparte la factorul de conversie ca sa dea cantitatea in UM-ul componentei", () => {
    const lines = distributeByPercentage(beton, 10_000);
    // 30% din 10.000 kg = 3.000 kg -> 3.000 / 1500 = 2 mc
    expect(lines[0]).toMatchObject({ unit: "mc", qty: 2, qtyInRecipeUnit: 3000 });
    // 7,5% din 10.000 kg = 750 kg -> 750 litri de apa
    expect(lines[1]).toMatchObject({ unit: "litru", qty: 750, qtyInRecipeUnit: 750 });
  });

  it("insumeaza omogen doar prin qtyInRecipeUnit (kg), nu prin cantitatile brute", () => {
    const lines = distributeByPercentage(beton, 10_000);
    expect(sumQtyInRecipeUnit(lines)).toBe(3750);
    // Suma bruta ar aduna 2 mc cu 750 litri - numar fara sens fizic, pastrat doar
    // ca dovada ca cele doua sume NU sunt interschimbabile.
    expect(sumQty(lines)).toBe(752);
  });

  it("propaga `isTracked` (itemii nelimitati sunt sariti de la consumul de stoc)", () => {
    const lines = distributeByPercentage(beton, 10_000);
    expect(lines.map((l) => l.isTracked)).toEqual([true, false]);
  });

  it("trateaza un factor invalid (0/negativ) ca 1, fara sa arunce", () => {
    const lines = distributeByPercentage([component({ percentage: 50, conversionFactor: 0 })], 100);
    expect(lines[0].qty).toBe(50);
  });

  it("matematica e identica pentru ambele directii ale retetei", () => {
    // `computeIdealOutput` (descompunere) si `computeRequiredConsumption`
    // (compunere) sunt aceeasi functie - directia decide doar ce e "totalul".
    expect(computeIdealOutput(beton, 10_000)).toEqual(computeRequiredConsumption(beton, 10_000));
  });
});

describe("toRecipeUnit", () => {
  it("converteste inapoi din UM-ul componentei in UM-ul retetei", () => {
    expect(toRecipeUnit(2, 1500)).toBe(3000);
  });

  it("trateaza un factor invalid ca 1", () => {
    expect(toRecipeUnit(2, 0)).toBe(2);
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

describe("sumQtyInRecipeUnit", () => {
  it("insumeaza cantitatile deja exprimate in UM-ul retetei", () => {
    expect(sumQtyInRecipeUnit([{ qtyInRecipeUnit: 1.5 }, { qtyInRecipeUnit: 2.25 }])).toBe(3.75);
  });

  it("returneaza 0 pentru o lista goala", () => {
    expect(sumQtyInRecipeUnit([])).toBe(0);
  });
});

describe("computeLoss (randament/pierderi - informativ, nevalidat)", () => {
  it("calculeaza diferenta input - output (pierdere pozitiva la reciclare)", () => {
    expect(computeLoss(500, 470)).toBe(30);
  });

  it("nu blocheaza/arunca daca output > input (doar raporteaza valoarea negativa)", () => {
    expect(computeLoss(100, 120)).toBe(-20);
  });

  it("randament perfect (fara pierderi)", () => {
    expect(computeLoss(300, 300)).toBe(0);
  });

  it("compara like-for-like cand se folosesc totalurile convertite", () => {
    // 10.000 kg de beton din 3.000 kg agregat + 750 kg apa => 6.250 kg "pierdere"
    // (aici: restul retetei nedefinit) - totaluri ambele in kg, nu in UM-uri mixte.
    const lines = distributeByPercentage(
      [
        component({ componentItemId: "nisip", unit: "mc", percentage: 30, conversionFactor: 1500 }),
        component({ componentItemId: "apa", unit: "litru", percentage: 7.5 }),
      ],
      10_000,
    );
    expect(computeLoss(10_000, sumQtyInRecipeUnit(lines))).toBe(6250);
  });
});

describe("roundQty", () => {
  it("rotunjeste la 3 zecimale, consistent cu numeric(14,3) din schema", () => {
    expect(roundQty(1.23456)).toBe(1.235);
    expect(roundQty(10)).toBe(10);
  });
});
