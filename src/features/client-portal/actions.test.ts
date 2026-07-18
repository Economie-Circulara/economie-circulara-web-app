import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { createOrderWithItems, sendOrder } = vi.hoisted(() => ({
  createOrderWithItems: vi.fn(),
  sendOrder: vi.fn(),
}));
vi.mock("@/features/orders/service", () => ({ createOrderWithItems, sendOrder }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { initialClientOrderFormState } from "./action-state";
import { createClientOrderAction } from "./actions";

afterEach(() => {
  vi.clearAllMocks();
});

function formData(fields: Record<string, string | string[]>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      for (const v of value) fd.append(key, v);
    } else {
      fd.set(key, value);
    }
  }
  return fd;
}

const CLIENT_USER = {
  id: "user-1",
  email: "client@example.com",
  role: "client" as const,
  organizationId: "org-1",
  clientId: "client-1",
  fullName: "Client demo",
};

describe("createClientOrderAction", () => {
  it("respinge un cos gol fara sa atinga serviciul de comenzi", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);

    const state = await createClientOrderAction(initialClientOrderFormState, formData({}));

    expect(state.error).toMatch(/coșul/i);
    expect(createOrderWithItems).not.toHaveBeenCalled();
  });

  it("respinge un cont client fara clientId/organizationId asociat", async () => {
    requireRole.mockResolvedValue({ ...CLIENT_USER, clientId: null });

    const state = await createClientOrderAction(
      initialClientOrderFormState,
      formData({ item_id: "item-1", quantity: "2" }),
    );

    expect(state.error).toMatch(/firm/i);
    expect(createOrderWithItems).not.toHaveBeenCalled();
  });

  it("creeaza comanda draft cu created_by_admin=false apoi o trimite (draft -> sent)", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    createOrderWithItems.mockResolvedValue({ id: "order-1", status: "draft" });
    sendOrder.mockResolvedValue({ id: "order-1", status: "sent" });

    const state = await createClientOrderAction(
      initialClientOrderFormState,
      formData({
        item_id: ["item-1", "item-2"],
        quantity: ["4", "2"],
        delivery_address_id: "addr-1",
        delivery_date: "2026-08-01",
        notes: "Livrare dimineața",
      }),
    );

    expect(createOrderWithItems).toHaveBeenCalledWith({
      organizationId: "org-1",
      clientId: "client-1",
      createdByAdmin: false,
      deliveryAddressId: "addr-1",
      deliveryDate: "2026-08-01",
      notes: "Livrare dimineața",
      lines: [
        { itemId: "item-1", quantity: 4 },
        { itemId: "item-2", quantity: 2 },
      ],
    });
    expect(sendOrder).toHaveBeenCalledWith("order-1", "org-1");
    expect(revalidatePath).toHaveBeenCalledWith("/comenzile-mele");
    expect(state).toEqual({ error: null, orderId: "order-1" });
  });

  it("ignora liniile incomplete (fara item sau cantitate invalida)", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    createOrderWithItems.mockResolvedValue({ id: "order-1", status: "draft" });
    sendOrder.mockResolvedValue({ id: "order-1", status: "sent" });

    await createClientOrderAction(
      initialClientOrderFormState,
      formData({ item_id: ["item-1", ""], quantity: ["3", "0"] }),
    );

    expect(createOrderWithItems).toHaveBeenCalledWith(
      expect.objectContaining({ lines: [{ itemId: "item-1", quantity: 3 }] }),
    );
  });

  it("propaga eroarea daca createOrderWithItems esueaza (fara a incerca sendOrder)", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    createOrderWithItems.mockRejectedValue(new Error("Nu am putut crea comanda."));

    const state = await createClientOrderAction(
      initialClientOrderFormState,
      formData({ item_id: "item-1", quantity: "1" }),
    );

    expect(state).toEqual({ error: "Nu am putut crea comanda.", orderId: null });
    expect(sendOrder).not.toHaveBeenCalled();
  });

  it("semnaleaza cand comanda a fost salvata dar trimiterea a esuat (ramane draft)", async () => {
    requireRole.mockResolvedValue(CLIENT_USER);
    createOrderWithItems.mockResolvedValue({ id: "order-1", status: "draft" });
    sendOrder.mockRejectedValue(new Error("Nu am putut genera numărul comenzii."));

    const state = await createClientOrderAction(
      initialClientOrderFormState,
      formData({ item_id: "item-1", quantity: "1" }),
    );

    expect(state.orderId).toBe("order-1");
    expect(state.error).toMatch(/salvată/i);
  });
});
