import { describe, expect, it } from "vitest";
import {
  consumptionDeviationPercent,
  consumptionPerEntry,
  odometerStats,
  pricePerLiter,
  summarizeFuelEntries,
} from "./calc";
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

describe("kilometraj si consum real", () => {
  const entry = (
    id: string,
    filledOn: string,
    odometerKm: number | null,
    liters: number,
  ): Parameters<typeof odometerStats>[0][number] => ({
    id,
    filledOn,
    odometerKm,
    liters,
    createdAt: `${filledOn}T10:00:00Z`,
  });

  it("km intre prima si ultima alimentare; consumul din litrii alimentarilor 2..n (plin)", () => {
    const stats = odometerStats([
      entry("c", "2026-10-10", 101_000, 330),
      entry("a", "2026-10-01", 100_000, 400),
      entry("b", "2026-10-05", 100_400, 120),
      entry("x", "2026-10-07", null, 50),
    ]);
    // 1000 km, litri dupa prima alimentare = 120 + 330 = 450 => 45 L/100 km.
    expect(stats).toEqual({ currentKm: 101_000, kmDriven: 1000, realConsumption: 45 });
  });

  it("sub doua alimentari cu kilometraj nu exista consum real", () => {
    expect(odometerStats([entry("a", "2026-10-01", 100_000, 400)])).toEqual({
      currentKm: 100_000,
      kmDriven: 0,
      realConsumption: null,
    });
    expect(odometerStats([entry("a", "2026-10-01", null, 400)]).currentKm).toBeNull();
  });

  it("consumul pe fiecare alimentare, fata de cea anterioara cu kilometraj", () => {
    const per = consumptionPerEntry([
      entry("a", "2026-10-01", 100_000, 400),
      entry("b", "2026-10-05", 100_400, 120),
      entry("c", "2026-10-10", 101_000, 210),
    ]);
    expect(per.get("a")).toEqual({ kmSincePrevious: null, consumption: null });
    expect(per.get("b")).toEqual({ kmSincePrevious: 400, consumption: 30 });
    expect(per.get("c")).toEqual({ kmSincePrevious: 600, consumption: 35 });
  });

  it("abaterea fata de consumul declarat", () => {
    expect(consumptionDeviationPercent(36, 30)).toBe(20);
    expect(consumptionDeviationPercent(27, 30)).toBe(-10);
  });
});
