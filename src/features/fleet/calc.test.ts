import { describe, expect, it } from "vitest";
import { pricePerLiter, summarizeFuelEntries } from "./calc";
import { todayInRomania } from "./dates";

describe("summarizeFuelEntries", () => {
  it("aduna litrii, suma doar unde exista, si gaseste ultima data", () => {
    const summary = summarizeFuelEntries([
      { liters: 80.5, amount: 603.75, filledOn: "2026-10-01" },
      { liters: 60.25, amount: null, filledOn: "2026-10-09" },
      { liters: 40, amount: 300, filledOn: "2026-10-05" },
    ]);
    expect(summary).toEqual({
      count: 3,
      liters: 180.75,
      amount: 903.75,
      amountCount: 2,
      lastFilledOn: "2026-10-09",
    });
  });

  it("lista goala", () => {
    expect(summarizeFuelEntries([])).toEqual({
      count: 0,
      liters: 0,
      amount: 0,
      amountCount: 0,
      lastFilledOn: null,
    });
  });
});

describe("pricePerLiter", () => {
  it("suma / litri, rotunjit la bani", () => {
    expect(pricePerLiter({ liters: 80, amount: 600 })).toBe(7.5);
    expect(pricePerLiter({ liters: 3, amount: 22 })).toBe(7.33);
    expect(pricePerLiter({ liters: 80, amount: null })).toBeNull();
  });
});

describe("todayInRomania", () => {
  it("foloseste fusul orar al Romaniei, nu UTC", () => {
    // 22:30 UTC pe 12 oct = 01:30 pe 13 oct la Bucuresti (UTC+3 vara).
    expect(todayInRomania(new Date("2026-10-12T22:30:00Z"))).toBe("2026-10-13");
  });
});
