import { describe, expect, it } from "vitest";
import {
  isPercentageSumComplete,
  sumPercentages,
  validateNotSelfReference,
  validatePercentage,
} from "./validation";

describe("validatePercentage", () => {
  it("accepta valori in (0, 100]", () => {
    expect(validatePercentage(50)).toBeNull();
    expect(validatePercentage(100)).toBeNull();
    expect(validatePercentage(0.001)).toBeNull();
  });

  it("respinge 0 si valori negative", () => {
    expect(validatePercentage(0)).toMatch(/mai mare/i);
    expect(validatePercentage(-5)).toMatch(/mai mare/i);
  });

  it("respinge valori peste 100", () => {
    expect(validatePercentage(100.5)).toMatch(/depăș/i);
  });

  it("respinge NaN/Infinity", () => {
    expect(validatePercentage(NaN)).toMatch(/număr/i);
    expect(validatePercentage(Infinity)).toMatch(/număr/i);
  });
});

describe("validateNotSelfReference", () => {
  it("respinge cand componenta e chiar itemul retetei", () => {
    expect(validateNotSelfReference("item-1", "item-1")).toMatch(/propriei rețete/i);
  });

  it("accepta cand componenta e alt item", () => {
    expect(validateNotSelfReference("item-1", "item-2")).toBeNull();
  });
});

describe("sumPercentages", () => {
  it("insumeaza procentele componentelor", () => {
    expect(sumPercentages([{ percentage: 30 }, { percentage: 45.5 }])).toBe(75.5);
  });

  it("returneaza 0 pentru lista goala", () => {
    expect(sumPercentages([])).toBe(0);
  });
});

describe("isPercentageSumComplete", () => {
  it("e true pentru suma exact 100", () => {
    expect(isPercentageSumComplete(100)).toBe(true);
  });

  it("e true in limita tolerantei", () => {
    expect(isPercentageSumComplete(99.995)).toBe(true);
  });

  it("e false cand suma difera semnificativ de 100 (dar NU blocheaza salvarea - vezi actions.ts)", () => {
    expect(isPercentageSumComplete(80)).toBe(false);
    expect(isPercentageSumComplete(120)).toBe(false);
  });
});
