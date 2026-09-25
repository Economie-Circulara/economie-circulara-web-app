import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { getOrderStatus } = vi.hoisted(() => ({ getOrderStatus: vi.fn() }));
vi.mock("./queries", () => ({ getOrderStatus }));

const { onOrderStatusChanged } = vi.hoisted(() => ({ onOrderStatusChanged: vi.fn() }));
vi.mock("./notifications", () => ({ onOrderStatusChanged }));

const {
  acceptIntakeOrder,
  acceptOrder,
  cancelOrder,
  createOrderWithItems,
  sendOrder,
  setOrderStatus,
} = vi.hoisted(() => ({
  acceptIntakeOrder: vi.fn(),
  acceptOrder: vi.fn(),
  cancelOrder: vi.fn(),
  createOrderWithItems: vi.fn(),
  sendOrder: vi.fn(),
  setOrderStatus: vi.fn(),
}));
vi.mock("./service", () => ({
  acceptIntakeOrder,
  acceptOrder,
  cancelOrder,
  createOrderWithItems,
  sendOrder,
  setOrderStatus,
}));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { InsufficientStockError } from "@/features/stock/service";
import {
  acceptIntakeAction,
  acceptOrderAction,
  cancelOrderAction,
  closeOrderAction,
  createOrderAction,
  deliverOrderAction,
  sendOrderAction,
} from "./actions";

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

describe("createOrderAction", () => {
  it("respinge cererea fara tip de comanda (nu exista default in UI)", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });

    const state = await createOrderAction(
      { error: null },
      formData({ client_id: "client-1", item_id: ["item-1"], quantity: ["2"] }),
    );

    expect(state.error).toMatch(/tipul comenzii/i);
    expect(createOrderWithItems).not.toHaveBeenCalled();
  });

  it("respinge un tip de comanda necunoscut", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });

    const state = await createOrderAction(
      { error: null },
      formData({ order_type: "altceva", client_id: "client-1", item_id: ["item-1"] }),
    );

    expect(state.error).toMatch(/tipul comenzii/i);
    expect(createOrderWithItems).not.toHaveBeenCalled();
  });

  it("respinge cererea cand lipseste clientul", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });

    const state = await createOrderAction(
      { error: null },
      formData({ order_type: "material", item_id: ["item-1"], quantity: ["2"] }),
    );

    expect(state.error).toMatch(/client/i);
    expect(createOrderWithItems).not.toHaveBeenCalled();
  });

  it("respinge cererea fara nicio linie valida", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });

    const state = await createOrderAction(
      { error: null },
      formData({ order_type: "material", client_id: "client-1" }),
    );

    expect(state.error).toMatch(/linie/i);
    expect(createOrderWithItems).not.toHaveBeenCalled();
  });

  it("ignora liniile incomplete (item lipsa sau cantitate invalida)", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    createOrderWithItems.mockResolvedValue({ id: "order-1" });

    await expect(
      createOrderAction(
        { error: null },
        formData({
          order_type: "material",
          client_id: "client-1",
          item_id: ["item-1", "", "item-3"],
          quantity: ["2", "5", "0"],
        }),
      ),
    ).rejects.toThrow("REDIRECT:/comenzi/order-1");

    expect(createOrderWithItems).toHaveBeenCalledWith(
      expect.objectContaining({ lines: [{ itemId: "item-1", quantity: 2 }] }),
    );
  });

  it("creeaza comanda si redirectioneaza catre /comenzi/:id cand datele sunt valide", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    createOrderWithItems.mockResolvedValue({ id: "order-9" });

    await expect(
      createOrderAction(
        { error: null },
        formData({
          order_type: "serviciu",
          client_id: "client-1",
          delivery_address_id: "addr-1",
          delivery_date: "2026-08-01",
          expected_return_date: "2026-09-01",
          notes: "livrare rapidă",
          item_id: ["item-1", "item-2"],
          quantity: ["4", "2,5"],
        }),
      ),
    ).rejects.toThrow("REDIRECT:/comenzi/order-9");

    expect(createOrderWithItems).toHaveBeenCalledWith({
      organizationId: "org-1",
      clientId: "client-1",
      orderType: "serviciu",
      createdByAdmin: true,
      deliveryAddressId: "addr-1",
      deliveryDate: "2026-08-01",
      expectedReturnDate: "2026-09-01",
      notes: "livrare rapidă",
      lines: [
        { itemId: "item-1", quantity: 4 },
        { itemId: "item-2", quantity: 2.5 },
      ],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/comenzi");
  });

  it("returneaza eroarea serviciului fara redirect", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    createOrderWithItems.mockRejectedValue(new Error("Client inexistent."));

    const state = await createOrderAction(
      { error: null },
      formData({
        order_type: "material",
        client_id: "client-x",
        item_id: ["item-1"],
        quantity: ["1"],
      }),
    );

    expect(state.error).toBe("Client inexistent.");
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("acceptIntakeAction", () => {
  it("accepta aportul prin RPC-ul dedicat si notifica clientul cu formularea de aport", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    getOrderStatus.mockResolvedValue("sent");
    acceptIntakeOrder.mockResolvedValue({
      id: "order-aport",
      clientId: "client-1",
      status: "accepted",
    });

    const state = await acceptIntakeAction("order-aport");

    expect(state.error).toBeNull();
    expect(acceptIntakeOrder).toHaveBeenCalledWith("order-aport");
    expect(onOrderStatusChanged).toHaveBeenCalledWith({
      orderId: "order-aport",
      organizationId: "org-1",
      clientId: "client-1",
      fromStatus: "sent",
      toStatus: "accepted",
      kind: "intake",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/stoc");
  });

  it("intoarce mesajul de eroare al RPC-ului (ex. comanda nu e de tip aport)", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    acceptIntakeOrder.mockRejectedValue(new Error("Comanda nu este de tip aport."));

    const state = await acceptIntakeAction("order-1");

    expect(state.error).toBe("Comanda nu este de tip aport.");
    expect(onOrderStatusChanged).not.toHaveBeenCalled();
  });
});

describe("sendOrderAction", () => {
  it("respinge tranzitia daca statusul curent nu e draft (masina de stari)", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    getOrderStatus.mockResolvedValue("accepted");

    const state = await sendOrderAction({ error: null }, formData({ order_id: "order-1" }));

    expect(state.error).toMatch(/accepted/);
    expect(sendOrder).not.toHaveBeenCalled();
  });

  it("trimite comanda draft si emite onOrderStatusChanged", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    getOrderStatus.mockResolvedValue("draft");
    sendOrder.mockResolvedValue({ id: "order-1", clientId: "client-1", status: "sent" });

    const state = await sendOrderAction({ error: null }, formData({ order_id: "order-1" }));

    expect(sendOrder).toHaveBeenCalledWith("order-1", "org-1");
    expect(onOrderStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ orderId: "order-1", fromStatus: "draft", toStatus: "sent" }),
    );
    expect(state.error).toBeNull();
  });

  it("comanda inexistenta -> eroare fara sa apeleze sendOrder", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    getOrderStatus.mockResolvedValue(null);

    const state = await sendOrderAction({ error: null }, formData({ order_id: "order-x" }));

    expect(state.error).toMatch(/nu există/);
    expect(sendOrder).not.toHaveBeenCalled();
  });
});

describe("acceptOrderAction", () => {
  it("accepta o comanda sent (stoc suficient)", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    getOrderStatus.mockResolvedValue("sent");
    acceptOrder.mockResolvedValue({ id: "order-1", clientId: "client-1", status: "accepted" });

    const state = await acceptOrderAction({ error: null }, formData({ order_id: "order-1" }));

    expect(acceptOrder).toHaveBeenCalledWith("order-1");
    expect(state.error).toBeNull();
  });

  it("propaga eroarea de stoc insuficient din service (RPC accept_order/consume_fifo)", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    getOrderStatus.mockResolvedValue("sent");
    acceptOrder.mockRejectedValue(new Error("Stoc insuficient pentru itemul item-1"));

    const state = await acceptOrderAction({ error: null }, formData({ order_id: "order-1" }));

    expect(state.error).toMatch(/stoc/i);
  });

  it("alimenteaza CTA-ul 'Adaugă stoc' cu item-ul cand InsufficientStockError il cunoaste", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    getOrderStatus.mockResolvedValue("sent");
    acceptOrder.mockRejectedValue(
      new InsufficientStockError("item-1", 5, 'Stoc insuficient pentru itemul "Paleti EUR".'),
    );

    const state = await acceptOrderAction({ error: null }, formData({ order_id: "order-1" }));

    expect(state.error).toBe('Stoc insuficient pentru itemul "Paleti EUR".');
    expect(state.insufficientStockItemId).toBe("item-1");
  });

  it("respinge acceptarea unei comenzi draft (masina de stari, fara sa apeleze RPC-ul)", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    getOrderStatus.mockResolvedValue("draft");

    const state = await acceptOrderAction({ error: null }, formData({ order_id: "order-1" }));

    expect(state.error).toMatch(/draft/);
    expect(acceptOrder).not.toHaveBeenCalled();
  });
});

describe("cancelOrderAction", () => {
  it("anuleaza o comanda accepted (reface stocul, in service/RPC)", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    getOrderStatus.mockResolvedValue("accepted");
    cancelOrder.mockResolvedValue({ id: "order-1", clientId: "client-1", status: "cancelled" });

    const state = await cancelOrderAction({ error: null }, formData({ order_id: "order-1" }));

    expect(cancelOrder).toHaveBeenCalledWith("order-1");
    expect(onOrderStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ fromStatus: "accepted", toStatus: "cancelled" }),
    );
    expect(state.error).toBeNull();
  });

  it("respinge anularea unei comenzi deja livrate (masina de stari)", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    getOrderStatus.mockResolvedValue("delivered");

    const state = await cancelOrderAction({ error: null }, formData({ order_id: "order-1" }));

    expect(state.error).toMatch(/delivered/);
    expect(cancelOrder).not.toHaveBeenCalled();
  });
});

describe("deliverOrderAction / closeOrderAction", () => {
  it("marcheaza livrata o comanda accepted", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    getOrderStatus.mockResolvedValue("accepted");
    setOrderStatus.mockResolvedValue({ id: "order-1", clientId: "client-1", status: "delivered" });

    const state = await deliverOrderAction({ error: null }, formData({ order_id: "order-1" }));

    expect(setOrderStatus).toHaveBeenCalledWith("order-1", "delivered");
    expect(state.error).toBeNull();
  });

  it("inchide o comanda delivered si emite evenimentul cu toStatus closed (hook pt. Task G)", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    getOrderStatus.mockResolvedValue("delivered");
    setOrderStatus.mockResolvedValue({ id: "order-1", clientId: "client-1", status: "closed" });

    const state = await closeOrderAction({ error: null }, formData({ order_id: "order-1" }));

    expect(setOrderStatus).toHaveBeenCalledWith("order-1", "closed");
    expect(onOrderStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ toStatus: "closed" }),
    );
    expect(state.error).toBeNull();
  });

  it("respinge inchiderea unei comenzi care nu e delivered", async () => {
    requireRole.mockResolvedValue({ id: "u1", organizationId: "org-1" });
    getOrderStatus.mockResolvedValue("accepted");

    const state = await closeOrderAction({ error: null }, formData({ order_id: "order-1" }));

    expect(state.error).toMatch(/accepted/);
    expect(setOrderStatus).not.toHaveBeenCalled();
  });
});
