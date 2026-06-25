import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("imbina clase simple", () => {
    expect(cn("px-2", "py-1")).toBe("px-2 py-1");
  });

  it("pastreaza ultima clasa Tailwind in conflict", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("ignora valorile falsy si conditionale", () => {
    expect(cn("text-sm", false, undefined, null, "font-bold")).toBe("text-sm font-bold");
  });
});
