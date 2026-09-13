import { describe, expect, it } from "vitest";
import { formatIssuerLine } from "./issuer";

describe("formatIssuerLine", () => {
  it("combina toate cele 3 campuri, cu eticheta doar pe CUI", () => {
    expect(formatIssuerLine("RO123", "J40/1/2020", "Str. Exemplu nr. 1")).toBe(
      "CUI RO123 · J40/1/2020 · Str. Exemplu nr. 1",
    );
  });

  it("sare peste campurile lipsa, fara separatori orfani", () => {
    expect(formatIssuerLine("RO123", null, null)).toBe("CUI RO123");
    expect(formatIssuerLine(null, "J40/1/2020", null)).toBe("J40/1/2020");
    expect(formatIssuerLine(null, null, "Str. Exemplu")).toBe("Str. Exemplu");
  });

  it("null cand niciun camp nu e completat (organizatie neactualizata din Setari)", () => {
    expect(formatIssuerLine(null, null, null)).toBeNull();
    expect(formatIssuerLine(undefined, undefined, undefined)).toBeNull();
  });
});
