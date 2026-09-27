import { describe, expect, it } from "vitest";
import {
  InvalidOrderTransitionError,
  assertOrderTransition,
  canAcceptIntake,
  canTransitionOrder,
  canTransitionOrderInFlow,
  orderFlowOf,
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

describe("orderFlowOf", () => {
  it("aportul si comenzile-retur/garantie sunt intake; restul vanzare", () => {
    expect(orderFlowOf("aport", null)).toBe("intake");
    expect(orderFlowOf("material", "return")).toBe("intake");
    expect(orderFlowOf("serviciu", "warranty")).toBe("intake");
    expect(orderFlowOf("material", "replacement")).toBe("sale");
    expect(orderFlowOf("material", null)).toBe("sale");
  });
});

describe("canTransitionOrderInFlow", () => {
  it("pe vanzare urmeaza masina de stari obisnuita", () => {
    expect(canTransitionOrderInFlow("sent", "accepted", "sale")).toBe(true);
    expect(canTransitionOrderInFlow("accepted", "delivered", "sale")).toBe(true);
  });

  it("intake-ul nu are tranzitii generice de vanzare", () => {
    expect(canTransitionOrderInFlow("draft", "sent", "intake")).toBe(false);
    expect(canTransitionOrderInFlow("sent", "accepted", "intake")).toBe(false);
    expect(canTransitionOrderInFlow("accepted", "delivered", "intake")).toBe(false);
  });

  it("intake-ul se poate anula doar inainte sa intre in stoc", () => {
    expect(canTransitionOrderInFlow("draft", "cancelled", "intake")).toBe(true);
    expect(canTransitionOrderInFlow("sent", "cancelled", "intake")).toBe(true);
    expect(canTransitionOrderInFlow("accepted", "cancelled", "intake")).toBe(false);
  });
});

describe("canAcceptIntake", () => {
  it("accepta din draft (staff) si sent (portal)", () => {
    expect(canAcceptIntake("draft")).toBe(true);
    expect(canAcceptIntake("sent")).toBe(true);
    expect(canAcceptIntake("accepted")).toBe(false);
    expect(canAcceptIntake("cancelled")).toBe(false);
  });
});
