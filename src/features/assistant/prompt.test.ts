import { describe, expect, it } from "vitest";
import { systemPrompt } from "./prompt";
import type { ToolContext } from "./types";

const ctx = { role: "admin" } as ToolContext;

describe("systemPrompt", () => {
  it("se prezinta cu numele aplicatiei tenantului", () => {
    const prompt = systemPrompt(ctx, "Firma A SRL", "Trasabil A");
    expect(prompt).toContain("asistentul aplicației „Trasabil A”");
    expect(prompt).not.toContain("Lot cu Lot");
  });

  it("implicit foloseste numele platformei", () => {
    expect(systemPrompt(ctx, "Firma C SRL")).toContain("asistentul aplicației „Lot cu Lot”");
  });
});
