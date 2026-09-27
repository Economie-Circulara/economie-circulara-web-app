import { describe, expect, it } from "vitest";
import {
  describeLimitChange,
  orgCreditStatus,
  validateCreditGrant,
  validateCreditSettings,
  validateOrgAiLimits,
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

describe("validateCreditSettings / validateOrgAiLimits", () => {
  it("valoarea creditului intre 0 si 1 USD; plafonul per mesaj intreg >= 0", () => {
    expect(validateCreditSettings({ creditUsd: 0.001, turnCreditLimit: 100 })).toBeNull();
    expect(validateCreditSettings({ creditUsd: 0.001, turnCreditLimit: 0 })).toBeNull();
    expect(validateCreditSettings({ creditUsd: 0, turnCreditLimit: 100 })).toMatch(/între 0 și 1/);
    expect(validateCreditSettings({ creditUsd: 0.001, turnCreditLimit: 1.5 })).toMatch(/întreg/);
  });

  it("bugetul lunar intreg >= 0; procentul zilnic 0-100", () => {
    expect(validateOrgAiLimits({ monthlyCredits: 2000, dailyPercent: 20 })).toBeNull();
    expect(validateOrgAiLimits({ monthlyCredits: 0, dailyPercent: 0 })).toBeNull();
    expect(validateOrgAiLimits({ monthlyCredits: -1, dailyPercent: 20 })).toMatch(/Bugetul/);
    expect(validateOrgAiLimits({ monthlyCredits: 2000, dailyPercent: 150 })).toMatch(/Procentul/);
  });
});

describe("orgCreditStatus", () => {
  const base = { enabled: true, monthlyBase: 2000, monthlyBonus: 0 };

  it("OK / peste 80% / epuizat, cu creditele extra adunate la buget", () => {
    expect(orgCreditStatus({ ...base, usedCredits: 500 })).toEqual({
      limit: 2000,
      percent: 25,
      state: "ok",
    });
    expect(orgCreditStatus({ ...base, usedCredits: 1700 }).state).toBe("warning");
    expect(orgCreditStatus({ ...base, usedCredits: 2000 }).state).toBe("blocked");
    expect(orgCreditStatus({ ...base, monthlyBonus: 500, usedCredits: 2000 })).toEqual({
      limit: 2500,
      percent: 80,
      state: "warning",
    });
  });

  it("oprit are prioritate; bugetul 0 e nelimitat", () => {
    expect(orgCreditStatus({ ...base, enabled: false, usedCredits: 9999 }).state).toBe("disabled");
    expect(orgCreditStatus({ ...base, monthlyBase: 0, usedCredits: 9999 })).toEqual({
      limit: 0,
      percent: null,
      state: "unlimited",
    });
  });
});

describe("validateCreditGrant", () => {
  it("credite intregi pozitive si motiv obligatoriu", () => {
    expect(validateCreditGrant({ credits: 500, reason: "cerere client, factura 12" })).toBeNull();
    expect(validateCreditGrant({ credits: 0, reason: "motiv" })).toMatch(/întreg pozitiv/);
    expect(validateCreditGrant({ credits: 1.5, reason: "motiv" })).toMatch(/întreg pozitiv/);
    expect(validateCreditGrant({ credits: 500, reason: null })).toMatch(/obligatoriu/);
    expect(validateCreditGrant({ credits: 500, reason: "  a " })).toMatch(/obligatoriu/);
  });
});

describe("describeLimitChange", () => {
  it("top-up: credite + motiv", () => {
    expect(
      describeLimitChange({
        type: "grant",
        before: null,
        after: { credits: 500, month: "2026-09-01", reason: "factura 12" },
      }),
    ).toBe("+500 credite pentru luna aceasta - factura 12");
  });

  it("limite: doar campurile schimbate, in limbaj clar", () => {
    expect(
      describeLimitChange({
        type: "limits",
        before: {
          ai_enabled: true,
          ai_monthly_credit_limit: 2000,
          ai_daily_user_credit_percent: 20,
        },
        after: { ai_enabled: false, ai_monthly_credit_limit: 0, ai_daily_user_credit_percent: 20 },
      }),
    ).toBe("asistent: activ → oprit; buget lunar: 2000 credite → nelimitat");
  });
});
