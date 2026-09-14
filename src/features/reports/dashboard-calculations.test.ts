import { describe, expect, it } from "vitest";
import { buildStockTrends, findLowStockItems } from "./dashboard-calculations";

describe("findLowStockItems", () => {
  it("agrega loturile pe item si semnaleaza doar disponibilul de cel mult 20%", () => {
    const result = findLowStockItems([
      {
        itemId: "a",
        itemTitle: "Pietris",
        unit: "kg",
        initialQty: 100,
        remainingQty: 10,
        isBlocked: false,
      },
      {
        itemId: "a",
        itemTitle: "Pietris",
        unit: "kg",
        initialQty: 50,
        remainingQty: 20,
        isBlocked: true,
      },
      {
        itemId: "b",
        itemTitle: "Ciment",
        unit: "kg",
        initialQty: 100,
        remainingQty: 21,
        isBlocked: false,
      },
    ]);

    expect(result).toEqual([
      {
        itemId: "a",
        itemTitle: "Pietris",
        unit: "kg",
        initialQty: 150,
        remainingQty: 30,
        availabilityPercent: 20,
        blockedLots: 1,
      },
    ]);
  });
});

describe("buildStockTrends", () => {
  it("reconstruieste nivelul de final de zi din stocul actual si auditul semnat", () => {
    const result = buildStockTrends(
      [
        {
          itemId: "a",
          itemTitle: "Pietris",
          unit: "kg",
          initialQty: 100,
          remainingQty: 80,
          isBlocked: false,
        },
      ],
      [
        { unit: "kg", createdAt: "2026-09-12T08:00:00.000Z", quantity: -30 },
        { unit: "kg", createdAt: "2026-09-13T08:00:00.000Z", quantity: 10 },
      ],
      new Date("2026-09-13T12:00:00.000Z"),
      3,
    );

    expect(result).toEqual([
      {
        unit: "kg",
        points: [
          { date: "2026-09-11", quantity: 100 },
          { date: "2026-09-12", quantity: 70 },
          { date: "2026-09-13", quantity: 80 },
        ],
      },
    ]);
  });

  it("nu amesteca unitati de masura diferite", () => {
    const result = buildStockTrends(
      [
        {
          itemId: "a",
          itemTitle: "Pietris",
          unit: "kg",
          initialQty: 100,
          remainingQty: 50,
          isBlocked: false,
        },
        {
          itemId: "b",
          itemTitle: "Pavaj",
          unit: "buc",
          initialQty: 10,
          remainingQty: 6,
          isBlocked: false,
        },
      ],
      [],
      new Date("2026-09-13T12:00:00.000Z"),
      2,
    );

    expect(result.map((trend) => [trend.unit, trend.points.at(-1)?.quantity])).toEqual([
      ["buc", 6],
      ["kg", 50],
    ]);
  });
});
