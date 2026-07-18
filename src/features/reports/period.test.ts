import { describe, expect, it } from "vitest";
import {
  currentMonthRange,
  exclusiveEndOfDay,
  formatRangeLabel,
  isDateWithinRange,
  parseDateRange,
  startOfDayIso,
} from "./period";

describe("currentMonthRange", () => {
  it("intoarce prima zi a lunii curente pana azi", () => {
    const now = new Date("2026-07-18T14:30:00.000Z");
    expect(currentMonthRange(now)).toEqual({ from: "2026-07-01", to: "2026-07-18" });
  });
});

describe("parseDateRange", () => {
  const now = new Date("2026-07-18T00:00:00.000Z");

  it("foloseste perioada primita cand e valida", () => {
    expect(parseDateRange({ from: "2026-06-01", to: "2026-06-30" }, now)).toEqual({
      from: "2026-06-01",
      to: "2026-06-30",
    });
  });

  it("cade pe luna curenta daca lipsesc parametrii", () => {
    expect(parseDateRange({}, now)).toEqual(currentMonthRange(now));
  });

  it("cade pe luna curenta daca datele sunt invalide (format gresit)", () => {
    expect(parseDateRange({ from: "not-a-date", to: "2026-13-40" }, now)).toEqual(
      currentMonthRange(now),
    );
  });

  it("inverseaza defensiv daca from > to", () => {
    expect(parseDateRange({ from: "2026-07-31", to: "2026-07-01" }, now)).toEqual({
      from: "2026-07-01",
      to: "2026-07-31",
    });
  });
});

describe("startOfDayIso / exclusiveEndOfDay", () => {
  it("genereaza limitele corecte pentru query-uri .gte/.lt", () => {
    expect(startOfDayIso("2026-07-01")).toBe("2026-07-01T00:00:00.000Z");
    expect(exclusiveEndOfDay("2026-07-31")).toBe("2026-08-01T00:00:00.000Z");
  });

  it("gestioneaza corect trecerea intre luni/ani", () => {
    expect(exclusiveEndOfDay("2026-12-31")).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("isDateWithinRange", () => {
  const range = { from: "2026-07-01", to: "2026-07-18" };

  it("include capetele intervalului", () => {
    expect(isDateWithinRange("2026-07-01", range)).toBe(true);
    expect(isDateWithinRange("2026-07-18", range)).toBe(true);
  });

  it("accepta timestamp complet (nu doar data)", () => {
    expect(isDateWithinRange("2026-07-10T23:59:59.000Z", range)).toBe(true);
  });

  it("respinge date in afara intervalului", () => {
    expect(isDateWithinRange("2026-06-30", range)).toBe(false);
    expect(isDateWithinRange("2026-07-19", range)).toBe(false);
  });

  it("respinge null/undefined/text invalid", () => {
    expect(isDateWithinRange(null, range)).toBe(false);
    expect(isDateWithinRange(undefined, range)).toBe(false);
    expect(isDateWithinRange("nu-e-data", range)).toBe(false);
  });
});

describe("formatRangeLabel", () => {
  it("formateaza perioada in romana", () => {
    const label = formatRangeLabel({ from: "2026-07-01", to: "2026-07-18" });
    expect(label).toContain("–");
    expect(label).toContain("2026");
  });
});
