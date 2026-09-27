import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { getReturnableItems: queryReturnableItems } = vi.hoisted(() => ({
  getReturnableItems: vi.fn(),
}));
vi.mock("./queries", () => ({ getReturnableItems: queryReturnableItems }));

const { createReturnOrder, acceptReturnOrder } = vi.hoisted(() => ({
  createReturnOrder: vi.fn(),
  acceptReturnOrder: vi.fn(),
}));
vi.mock("./service", () => ({
  createReturnOrder,
  acceptReturnOrder,
  ReturnNotFoundError: class ReturnNotFoundError extends Error {},
  ReturnPermissionError: class ReturnPermissionError extends Error {},
  ReturnTransitionError: class ReturnTransitionError extends Error {},
  ReturnValidationError: class ReturnValidationError extends Error {},
}));

const { sendOrder } = vi.hoisted(() => ({ sendOrder: vi.fn() }));
vi.mock("@/features/orders/service", () => ({ sendOrder }));

const { getOrderStatus } = vi.hoisted(() => ({ getOrderStatus: vi.fn() }));
vi.mock("@/features/orders/queries", () => ({ getOrderStatus }));

const { onOrderStatusChanged } = vi.hoisted(() => ({ onOrderStatusChanged: vi.fn() }));
vi.mock("@/features/orders/notifications", () => ({ onOrderStatusChanged }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { acceptReturnAction, createReturnAction, getReturnableItems } from "./actions";

afterEach(() => {
  vi.clearAllMocks();
});

describe("createReturnAction", () => {
  it("permite rolul client sa creeze un retur (createdByAdmin=false)", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "client", organizationId: "org-1" });
    createReturnOrder.mockResolvedValue({ returnOrderId: "return-1", replacementOrderId: null });

    const result = await createReturnAction({
      originalOrderId: "order-orig",
      type: "return",
      items: [{ orderItemId: "oi-1", quantity: 4 }],
    });

    expect(requireRole).toHaveBeenCalledWith(["admin", "operator", "client"]);
    expect(createReturnOrder).toHaveBeenCalledWith(
      expect.objectContaining({ originalOrderId: "order-orig", createdByAdmin: false }),
    );
    expect(result).toEqual({ returnOrderId: "return-1", replacementOrderId: null });
    // Cererea clientului e trimisa, nu ramane ciorna (0044).
    expect(sendOrder).toHaveBeenCalledWith("return-1", "org-1");
  });

  it("garantie din portal: trimite si comanda-retur, si comanda de inlocuire", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "client", organizationId: "org-1" });
    createReturnOrder.mockResolvedValue({ returnOrderId: "ret-1", replacementOrderId: "repl-1" });

    await createReturnAction({
      originalOrderId: "order-orig",
      type: "warranty",
      items: [{ orderItemId: "oi-1", quantity: 1 }],
    });

    expect(sendOrder).toHaveBeenCalledWith("ret-1", "org-1");
    expect(sendOrder).toHaveBeenCalledWith("repl-1", "org-1");
  });

  it("daca trimiterea esueaza, intoarce eroarea (cererea ramane salvata)", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "client", organizationId: "org-1" });
    createReturnOrder.mockResolvedValue({ returnOrderId: "ret-1", replacementOrderId: null });
    sendOrder.mockRejectedValueOnce(new Error("numar indisponibil"));

    const result = await createReturnAction({
      originalOrderId: "order-orig",
      type: "return",
      items: [{ orderItemId: "oi-1", quantity: 1 }],
    });

    expect(result).toEqual({
      error: "Cererea a fost salvată, dar nu a putut fi trimisă: numar indisponibil",
    });
  });

  it("marcheaza createdByAdmin=true cand e creat de staff (admin/operator)", async () => {
    requireRole.mockResolvedValue({ id: "u2", role: "admin" });
    createReturnOrder.mockResolvedValue({ returnOrderId: "return-2", replacementOrderId: null });

    await createReturnAction({
      originalOrderId: "order-orig",
      type: "return",
      items: [{ orderItemId: "oi-1", quantity: 4 }],
    });

    expect(createReturnOrder).toHaveBeenCalledWith(
      expect.objectContaining({ createdByAdmin: true }),
    );
    // Returul creat de staff ramane draft - se accepta direct.
    expect(sendOrder).not.toHaveBeenCalled();
  });

  it("garanție: propaga replacementOrderId din service", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "client" });
    createReturnOrder.mockResolvedValue({
      returnOrderId: "return-1",
      replacementOrderId: "repl-1",
    });

    const result = await createReturnAction({
      originalOrderId: "order-orig",
      type: "warranty",
      items: [{ orderItemId: "oi-1", quantity: 4 }],
    });

    expect(result).toEqual({ returnOrderId: "return-1", replacementOrderId: "repl-1" });
    expect(revalidatePath).toHaveBeenCalledWith("/comenzi");
  });

  it("returneaza eroare tipizata (FormState-style) cand serviciul aruncă", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "client" });
    createReturnOrder.mockRejectedValue(new Error("Cantitate prea mare pentru X."));

    const result = await createReturnAction({
      originalOrderId: "order-orig",
      type: "return",
      items: [{ orderItemId: "oi-1", quantity: 999 }],
    });

    expect(result).toEqual({ error: "Cantitate prea mare pentru X." });
  });
});

describe("acceptReturnAction", () => {
  it("cere rolul staff (admin/operator) - clientul NU e in lista de roluri permise", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "admin" });
    acceptReturnOrder.mockResolvedValue({ id: "return-1", status: "accepted" });

    await acceptReturnAction("return-1");

    expect(requireRole).toHaveBeenCalledWith(["admin", "operator"]);
    expect(requireRole).not.toHaveBeenCalledWith(expect.arrayContaining(["client"]));
  });

  it("accepta o comanda-retur si notifica clientul cu formularea de retur", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "operator", organizationId: "org-1" });
    getOrderStatus.mockResolvedValue("sent");
    acceptReturnOrder.mockResolvedValue({ id: "return-1", clientId: "c1", status: "accepted" });

    const result = await acceptReturnAction("return-1");

    expect(acceptReturnOrder).toHaveBeenCalledWith("return-1");
    expect(onOrderStatusChanged).toHaveBeenCalledWith({
      orderId: "return-1",
      organizationId: "org-1",
      clientId: "c1",
      fromStatus: "sent",
      toStatus: "accepted",
      kind: "return",
    });
    expect(result.error).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/comenzi/return-1");
  });

  it("propaga eroarea tipizata cand serviciul aruncă (ex. deja acceptată)", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "admin" });
    acceptReturnOrder.mockRejectedValue(new Error("Comanda-retur nu poate fi acceptată."));

    const result = await acceptReturnAction("return-1");

    expect(result.error).toBe("Comanda-retur nu poate fi acceptată.");
  });
});

describe("getReturnableItems (action wrapper)", () => {
  it("permite oricare rol autentificat (client vede doar ale lui, prin RLS)", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "client" });
    queryReturnableItems.mockResolvedValue([
      {
        orderItemId: "oi-1",
        itemId: "item-1",
        itemTitle: "Cărămidă eco",
        unit: "buc",
        orderedQuantity: 10,
        alreadyReturnedQuantity: 0,
        returnableQuantity: 10,
      },
    ]);

    const result = await getReturnableItems("order-orig");

    expect(requireRole).toHaveBeenCalledWith(["admin", "operator", "client"]);
    expect(queryReturnableItems).toHaveBeenCalledWith("order-orig");
    expect(result).toHaveLength(1);
  });
});
