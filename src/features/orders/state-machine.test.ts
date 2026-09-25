import { describe, expect, it } from "vitest";
import {
  InvalidOrderTransitionError,
  assertOrderTransition,
  canAcceptIntake,
  canTransitionOrder,
  canTransitionOrderOfType,
  isCancellable,
} from "./state-machine";

describe("canTransitionOrder", () => {
  it.each([
    ["draft", "sent"],
    ["draft", "cancelled"],
    ["sent", "accepted"],
    ["sent", "cancelled"],
    ["accepted", "delivered"],
    ["accepted", "cancelled"],
    ["delivered", "closed"],
  ] as const)("permite %s -> %s", (from, to) => {
    expect(canTransitionOrder(from, to)).toBe(true);
  });

  it.each([
    ["draft", "accepted"],
    ["draft", "delivered"],
    ["draft", "closed"],
    ["sent", "delivered"],
    ["sent", "draft"],
    ["accepted", "sent"],
    ["accepted", "closed"],
    ["delivered", "cancelled"],
    ["delivered", "accepted"],
    ["closed", "cancelled"],
    ["closed", "delivered"],
    ["cancelled", "draft"],
    ["cancelled", "sent"],
  ] as const)("respinge %s -> %s", (from, to) => {
    expect(canTransitionOrder(from, to)).toBe(false);
  });
});

describe("assertOrderTransition", () => {
  it("nu arunca pentru o tranzitie valida", () => {
    expect(() => assertOrderTransition("sent", "accepted")).not.toThrow();
  });

  it("arunca InvalidOrderTransitionError pentru o tranzitie invalida", () => {
    expect(() => assertOrderTransition("delivered", "cancelled")).toThrow(
      InvalidOrderTransitionError,
    );
  });

  it("mesajul de eroare mentioneaza statusurile implicate", () => {
    try {
      assertOrderTransition("closed", "draft");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidOrderTransitionError);
      expect((err as InvalidOrderTransitionError).from).toBe("closed");
      expect((err as InvalidOrderTransitionError).to).toBe("draft");
      expect((err as Error).message).toMatch(/closed/);
      expect((err as Error).message).toMatch(/draft/);
    }
  });
});

describe("isCancellable", () => {
  it.each(["draft", "sent", "accepted"] as const)("%s este anulabil", (status) => {
    expect(isCancellable(status)).toBe(true);
  });

  it.each(["delivered", "closed", "cancelled"] as const)("%s NU este anulabil", (status) => {
    expect(isCancellable(status)).toBe(false);
  });
});

describe("canTransitionOrderOfType", () => {
  it("pentru material/serviciu urmeaza masina de stari obisnuita", () => {
    expect(canTransitionOrderOfType("sent", "accepted", "material")).toBe(true);
    expect(canTransitionOrderOfType("accepted", "delivered", "serviciu")).toBe(true);
  });

  it("aportul nu are tranzitii generice de vanzare", () => {
    expect(canTransitionOrderOfType("draft", "sent", "aport")).toBe(false);
    expect(canTransitionOrderOfType("sent", "accepted", "aport")).toBe(false);
    expect(canTransitionOrderOfType("accepted", "delivered", "aport")).toBe(false);
  });

  it("aportul se poate anula doar inainte sa intre in stoc", () => {
    expect(canTransitionOrderOfType("draft", "cancelled", "aport")).toBe(true);
    expect(canTransitionOrderOfType("sent", "cancelled", "aport")).toBe(true);
    expect(canTransitionOrderOfType("accepted", "cancelled", "aport")).toBe(false);
  });
});

describe("canAcceptIntake", () => {
  it("accepta aportul din draft (staff) si sent (portal)", () => {
    expect(canAcceptIntake("draft")).toBe(true);
    expect(canAcceptIntake("sent")).toBe(true);
    expect(canAcceptIntake("accepted")).toBe(false);
    expect(canAcceptIntake("cancelled")).toBe(false);
  });
});
