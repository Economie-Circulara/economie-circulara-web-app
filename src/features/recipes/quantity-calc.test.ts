import { describe, expect, it } from "vitest";
import {
  applyDividerDrag,
  computeSegmentWidths,
  distributeExact,
  percentagesToQuantities,
  quantitiesToPercentages,
  scaleQuantities,
  sumPercentages,
  sumQuantities,
} from "./quantity-calc";

describe("distributeExact", () => {
  it("rotunjeste fiecare valoare la numarul de zecimale cerut", () => {
    expect(distributeExact([33.333, 33.333, 33.334], 2)).toEqual([33.33, 33.33, 33.34]);
  });

  it("garanteaza ca suma rotunjita e exacta, nu doar suma rotunjirilor independente", () => {
    // 1/3 * 100 = 33.333... de trei ori -> rotunjire independenta ar da 33.33*3 = 99.99,
    // nu 100. distributeExact trebuie sa corecteze o valoare ca suma sa fie exact 100.
    const values = [100 / 3, 100 / 3, 100 / 3];
    const result = distributeExact(values, 2);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100) / 100).toBe(100);
    expect(result.filter((v) => v === 33.34)).toHaveLength(1);
    expect(result.filter((v) => v === 33.33)).toHaveLength(2);
  });

  it("intoarce lista goala pentru input gol", () => {
    expect(distributeExact([])).toEqual([]);
  });

  it("functioneaza si cu o singura valoare", () => {
    expect(distributeExact([12.3456], 3)).toEqual([12.346]);
  });

  it("gestioneaza si valori negative fara sa creeze exceptii", () => {
    const result = distributeExact([10, -3.333, -3.333, -3.334], 2);
    const sum = result.reduce((a, b) => a + b, 0);
    expect(Math.round(sum * 100) / 100).toBe(0);
  });
});

describe("quantitiesToPercentages", () => {
  it("converteste cantitati reale in procente cu suma exacta", () => {
    // 150 + 200 + 650 = 1000 -> batch 1000, suma procentelor trebuie sa fie EXACT 100.
    const result = quantitiesToPercentages(1000, [
      { id: "ciment", quantity: 150 },
      { id: "apa", quantity: 200 },
      { id: "nisip", quantity: 650 },
    ]);
    expect(result).toEqual([
      { id: "ciment", percentage: 15 },
      { id: "apa", percentage: 20 },
      { id: "nisip", percentage: 65 },
    ]);
    expect(sumPercentages(result)).toBe(100);
  });

  it("suma componentelor poate depasi 100% (Producție cu pierderi: se consuma mai mult decat rezulta)", () => {
    // Beton 1000 kg obtinut din 1100 kg materii prime (pierderi la procesare).
    const result = quantitiesToPercentages(1000, [
      { id: "ciment", quantity: 150 },
      { id: "apa", quantity: 250 },
      { id: "nisip", quantity: 700 },
    ]);
    expect(sumPercentages(result)).toBe(110);
  });

  it("suma componentelor poate fi sub 100% (Reciclare cu pierderi: rezulta mai putin decat s-a introdus)", () => {
    // 1000 kg moloz -> doar 900 kg materiale rezultate (10% pierdere la reciclare).
    const result = quantitiesToPercentages(1000, [
      { id: "nisip", quantity: 300 },
      { id: "pietris", quantity: 600 },
    ]);
    expect(sumPercentages(result)).toBe(90);
  });

  it("intoarce 0% pentru toate componentele cand cantitatea de baza e zero", () => {
    const result = quantitiesToPercentages(0, [
      { id: "a", quantity: 10 },
      { id: "b", quantity: 20 },
    ]);
    expect(result).toEqual([
      { id: "a", percentage: 0 },
      { id: "b", percentage: 0 },
    ]);
  });

  it("intoarce 0% cand cantitatea de baza e negativa sau invalida (NaN)", () => {
    expect(quantitiesToPercentages(-5, [{ id: "a", quantity: 10 }])).toEqual([
      { id: "a", percentage: 0 },
    ]);
    expect(quantitiesToPercentages(NaN, [{ id: "a", quantity: 10 }])).toEqual([
      { id: "a", percentage: 0 },
    ]);
  });

  it("intoarce lista goala pentru o lista de componente goala", () => {
    expect(quantitiesToPercentages(1000, [])).toEqual([]);
  });
});

describe("percentagesToQuantities", () => {
  it("e inversa lui quantitiesToPercentages pentru cazul tipic (suma 100%)", () => {
    const result = percentagesToQuantities(1000, [
      { id: "ciment", percentage: 15 },
      { id: "apa", percentage: 20 },
      { id: "nisip", percentage: 65 },
    ]);
    expect(result).toEqual([
      { id: "ciment", quantity: 150 },
      { id: "apa", quantity: 200 },
      { id: "nisip", quantity: 650 },
    ]);
    expect(sumQuantities(result)).toBe(1000);
  });

  it("intoarce 0 pentru batch zero sau gol", () => {
    expect(percentagesToQuantities(0, [{ id: "a", percentage: 50 }])).toEqual([
      { id: "a", quantity: 0 },
    ]);
    expect(percentagesToQuantities(1000, [])).toEqual([]);
  });
});

describe('scaleQuantities (calculatorul "Pentru [X] {unitate}")', () => {
  it("rescaleaza cantitatile la o alta cantitate de baza, pastrand procentele", () => {
    const percentages = [
      { id: "ciment", percentage: 15 },
      { id: "apa", percentage: 20 },
      { id: "nisip", percentage: 65 },
    ];
    expect(scaleQuantities(2000, percentages)).toEqual([
      { id: "ciment", quantity: 300 },
      { id: "apa", quantity: 400 },
      { id: "nisip", quantity: 1300 },
    ]);
  });
});

describe("computeSegmentWidths", () => {
  it("normalizeaza latimile la 100% cand suma procentelor e 100", () => {
    const widths = computeSegmentWidths([
      { id: "a", percentage: 25 },
      { id: "b", percentage: 75 },
    ]);
    expect(widths.map((w) => w.widthPercent)).toEqual([25, 75]);
  });

  it("normalizeaza si cand suma depaseste 100% (Producție cu pierderi)", () => {
    const widths = computeSegmentWidths([
      { id: "a", percentage: 110 },
      { id: "b", percentage: 110 },
    ]);
    expect(widths.map((w) => w.widthPercent)).toEqual([50, 50]);
  });

  it("imparte latimea egal cand nicio cantitate nu a fost introdusa inca (suma 0)", () => {
    const widths = computeSegmentWidths([
      { id: "a", percentage: 0 },
      { id: "b", percentage: 0 },
      { id: "c", percentage: 0 },
    ]);
    widths.forEach((w) => expect(w.widthPercent).toBeCloseTo(100 / 3));
  });

  it("intoarce lista goala pentru zero componente", () => {
    expect(computeSegmentWidths([])).toEqual([]);
  });
});

describe("applyDividerDrag", () => {
  const base = [
    { id: "a", percentage: 30 },
    { id: "b", percentage: 50 },
    { id: "c", percentage: 20 },
  ];

  it("transfera puncte procentuale intre cele doua segmente adiacente, pastrand suma totala", () => {
    const result = applyDividerDrag(base, 0, 10);
    expect(result).toEqual([
      { id: "a", percentage: 40 },
      { id: "b", percentage: 40 },
      { id: "c", percentage: 20 },
    ]);
    expect(sumPercentages(result)).toBe(sumPercentages(base));
  });

  it("un delta negativ transfera in sens invers", () => {
    const result = applyDividerDrag(base, 1, -15);
    expect(result).toEqual([
      { id: "a", percentage: 30 },
      { id: "b", percentage: 35 },
      { id: "c", percentage: 35 },
    ]);
  });

  it("clampeaza mutarea ca niciun segment sa nu scada sub 0", () => {
    const result = applyDividerDrag(base, 0, -100);
    expect(result[0].percentage).toBe(0);
    expect(result[1].percentage).toBe(80);
  });

  it("nu modifica nimic daca segmentul din stanga e blocat", () => {
    const locked = [{ id: "a", percentage: 30, locked: true }, ...base.slice(1)];
    expect(applyDividerDrag(locked, 0, 10)).toEqual(locked);
  });

  it("nu modifica nimic daca segmentul din dreapta e blocat", () => {
    const locked = [base[0], { id: "b", percentage: 50, locked: true }, base[2]];
    expect(applyDividerDrag(locked, 0, 10)).toEqual(locked);
  });

  it("nu modifica nimic pentru un index de granita in afara listei", () => {
    expect(applyDividerDrag(base, 5, 10)).toEqual(base);
  });

  it("nu modifica alte segmente decat cele doua adiacente granitei", () => {
    const result = applyDividerDrag(base, 1, 5);
    expect(result[0]).toEqual(base[0]);
  });
});
