import { describe, expect, it } from "vitest";
import { canUseAssistant } from "./access";

describe("accesul la asistent", () => {
  it("staff-ul si super-adminul folosesc asistentul", () => {
    expect(canUseAssistant("admin")).toBe(true);
    expect(canUseAssistant("operator")).toBe(true);
    expect(canUseAssistant("super_admin")).toBe(true);
  });

  it("clientul nu are asistent", () => {
    expect(canUseAssistant("client")).toBe(false);
  });
});
