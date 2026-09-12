import { describe, expect, it } from "vitest";
import { THEME_PRESETS, colorPickerValue } from "./theme-presets";

describe("theme presets", () => {
  it("defines presets with native color-picker compatible colors", () => {
    expect(THEME_PRESETS.length).toBeGreaterThanOrEqual(3);
    for (const preset of THEME_PRESETS) {
      expect(preset.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.secondaryColor).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("keeps hex colors and falls back for free-form CSS values", () => {
    expect(colorPickerValue("#1F5E3A", "#000000")).toBe("#1F5E3A");
    expect(colorPickerValue("oklch(0.5 0.1 120)", "#000000")).toBe("#000000");
    expect(colorPickerValue(null, "#ffffff")).toBe("#ffffff");
  });
});
