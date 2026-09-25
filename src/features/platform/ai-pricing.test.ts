import { describe, expect, it } from "vitest";
import {
  costMicros,
  currentPrices,
  formatUsd,
  parseDecimal,
  validatePriceInput,
  type ModelPrice,
} from "./ai-pricing";

const V4_PRO = { inputCacheHitPerM: 0.022, inputCacheMissPerM: 0.66, outputPerM: 1.98 };

function price(model: string, validFrom: string, id = `${model}-${validFrom}`): ModelPrice {
  return { id, model, ...V4_PRO, validFrom, note: null, createdAt: validFrom };
}

describe("costMicros", () => {
  it("reproduce costul facturat de DeepSeek pe 25.09 (v4-pro): $0.0806652880", () => {
    const micros = costMicros(
      { inputCacheHit: 244864, inputCacheMiss: 63751, output: 16769 },
      V4_PRO,
    );
    // 80665.288 micro-USD, rotunjit in sus
    expect(micros).toBe(80666);
    expect(formatUsd(micros)).toBe("$0.0807");
  });
});

describe("formatUsd", () => {
  it("sub $1 cu 4 zecimale, restul cu 2", () => {
    expect(formatUsd(2600)).toBe("$0.0026");
    expect(formatUsd(1_234_567)).toBe("$1.23");
    expect(formatUsd(0)).toBe("$0.00");
  });
});

describe("currentPrices", () => {
  it("alege versiunea cea mai recenta deja intrata in vigoare", () => {
    const now = new Date("2026-10-15T00:00:00Z");
    const current = currentPrices(
      [
        price("deepseek-v4-pro", "2026-09-01T00:00:00Z", "old"),
        price("deepseek-v4-pro", "2026-10-01T00:00:00Z", "new"),
        price("deepseek-v4-pro", "2026-11-01T00:00:00Z", "future"),
        price("*", "2026-09-01T00:00:00Z", "default"),
      ],
      now,
    );
    expect(current.get("deepseek-v4-pro")?.id).toBe("new");
    expect(current.get("*")?.id).toBe("default");
  });
});

describe("validatePriceInput", () => {
  const ok = {
    model: "deepseek-v4-pro",
    inputCacheHitPerM: 0.022,
    inputCacheMissPerM: 0.66,
    outputPerM: 1.98,
    validFrom: null,
    note: null,
  };

  it("accepta un pret valid si pretul implicit `*`", () => {
    expect(validatePriceInput(ok)).toBeNull();
    expect(validatePriceInput({ ...ok, model: "*" })).toBeNull();
  });

  it("refuza model gol/invalid, preturi negative sau lipsa, data invalida", () => {
    expect(validatePriceInput({ ...ok, model: "" })).toMatch(/obligatoriu/);
    expect(validatePriceInput({ ...ok, model: "deep seek" })).toMatch(/litere/);
    expect(validatePriceInput({ ...ok, outputPerM: -1 })).toMatch(/output/);
    expect(validatePriceInput({ ...ok, inputCacheMissPerM: Number.NaN })).toMatch(/input nou/);
    expect(validatePriceInput({ ...ok, validFrom: "mâine" })).toMatch(/nu e validă/);
  });
});

describe("parseDecimal", () => {
  it("accepta virgula zecimala; gol = NaN", () => {
    expect(parseDecimal("0,66")).toBe(0.66);
    expect(Number.isNaN(parseDecimal(""))).toBe(true);
  });
});
