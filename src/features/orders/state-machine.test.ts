import { describe, expect, it } from "vitest";
import {
  InvalidOrderTransitionError,
  assertOrderTransition,
  canTransitionOrder,
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
