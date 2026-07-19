import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies — vezi AGENTS.md §2.2): inlocuim complet clientul Supabase server.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { InsufficientStockError } from "@/features/stock/service";
import {
  OrderNotFoundError,
  OrderPermissionError,
  OrderTransitionError,
  acceptOrder,
  cancelOrder,
  createOrderWithItems,
  generateOrderNumber,
  sendOrder,
  setOrderStatus,
} from "./service";

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    client_id: "client-1",
    order_number: "CMD-2026-0001",
    status: "sent",
    created_by_admin: true,
    delivery_address_id: null,
    delivery_date: null,
    expected_return_date: null,
    notes: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("generateOrderNumber", () => {
  it("apeleaza RPC generate_order_number si returneaza numarul", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "CMD-2026-0007", error: null });
    createClient.mockResolvedValue({ rpc });

    const result = await generateOrderNumber("org-1");

    expect(rpc).toHaveBeenCalledWith("generate_order_number", { p_org: "org-1" });
    expect(result).toBe("CMD-2026-0007");
  });

  it("arunca eroare cand RPC esueaza", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    createClient.mockResolvedValue({ rpc });

    await expect(generateOrderNumber("org-1")).rejects.toThrow("boom");
  });
});

describe("sendOrder", () => {
  it("aloca numarul (RPC) apoi seteaza status=sent + order_number intr-un UPDATE", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "CMD-2026-0002", error: null });
    const single = vi
      .fn()
      .mockResolvedValue({ data: orderRow({ order_number: "CMD-2026-0002" }), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    createClient.mockResolvedValue({ rpc, from });

    const order = await sendOrder("order-1", "org-1");

    expect(rpc).toHaveBeenCalledWith("generate_order_number", { p_org: "org-1" });
    expect(from).toHaveBeenCalledWith("orders");
    expect(update).toHaveBeenCalledWith({ status: "sent", order_number: "CMD-2026-0002" });
    expect(eq).toHaveBeenCalledWith("id", "order-1");
    expect(order.status).toBe("sent");
    expect(order.orderNumber).toBe("CMD-2026-0002");
  });

  it("propaga eroarea daca UPDATE-ul esueaza dupa alocarea numarului", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "CMD-2026-0003", error: null });
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "db down" } });
    const from = vi.fn().mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single }) }),
      }),
    });
    createClient.mockResolvedValue({ rpc, from });

    await expect(sendOrder("order-1", "org-1")).rejects.toThrow("db down");
  });
});

describe("setOrderStatus", () => {
  it("actualizeaza direct statusul si seteaza delivered_at la tranzitia -> delivered", async () => {
    const single = vi
      .fn()
      .mockResolvedValue({ data: orderRow({ status: "delivered" }), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    createClient.mockResolvedValue({ from });

    const order = await setOrderStatus("order-1", "delivered");

    expect(update).toHaveBeenCalledWith({
      status: "delivered",
      delivered_at: expect.any(String),
    });
    expect(order.status).toBe("delivered");
  });

  it("seteaza closed_at la tranzitia -> closed", async () => {
    const single = vi.fn().mockResolvedValue({ data: orderRow({ status: "closed" }), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    createClient.mockResolvedValue({ from });

    const order = await setOrderStatus("order-1", "closed");

    expect(update).toHaveBeenCalledWith({
      status: "closed",
      closed_at: expect.any(String),
    });
    expect(order.status).toBe("closed");
  });

  it("nu adauga delivered_at/closed_at pentru alte statusuri (ex. sent)", async () => {
    const single = vi.fn().mockResolvedValue({ data: orderRow({ status: "sent" }), error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    createClient.mockResolvedValue({ from });

    await setOrderStatus("order-1", "sent");

    expect(update).toHaveBeenCalledWith({ status: "sent" });
  });
});

describe("acceptOrder", () => {
  it("apeleaza RPC accept_order si returneaza comanda acceptata (stoc suficient)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: orderRow({ status: "accepted" }), error: null });
    createClient.mockResolvedValue({ rpc });

    const order = await acceptOrder("order-1");

    expect(rpc).toHaveBeenCalledWith("accept_order", { p_order_id: "order-1" });
    expect(order.status).toBe("accepted");
  });

  it("arunca InsufficientStockError cand RPC raporteaza LT001 (stoc insuficient la consum_fifo)", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "LT001", message: "Stoc insuficient pentru itemul item-1" },
    });
    createClient.mockResolvedValue({ rpc });

    await expect(acceptOrder("order-1")).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it("arunca OrderTransitionError cand comanda nu e in status sent (OR001)", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "OR001", message: 'Comanda nu poate fi acceptata din statusul "draft".' },
    });
    createClient.mockResolvedValue({ rpc });

    await expect(acceptOrder("order-1")).rejects.toBeInstanceOf(OrderTransitionError);
  });

  it("arunca OrderNotFoundError cand RPC raporteaza OR002", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "OR002", message: "not found" } });
    createClient.mockResolvedValue({ rpc });

    await expect(acceptOrder("order-x")).rejects.toBeInstanceOf(OrderNotFoundError);
  });

  it("arunca OrderPermissionError cand RPC raporteaza OR004 (client incearca sa accepte)", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "OR004", message: "forbidden" } });
    createClient.mockResolvedValue({ rpc });

    await expect(acceptOrder("order-1")).rejects.toBeInstanceOf(OrderPermissionError);
  });
});

describe("cancelOrder", () => {
  it("apeleaza RPC cancel_order si returneaza comanda anulata (reface stocul intern, in SQL)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: orderRow({ status: "cancelled" }), error: null });
    createClient.mockResolvedValue({ rpc });

    const order = await cancelOrder("order-1");

    expect(rpc).toHaveBeenCalledWith("cancel_order", { p_order_id: "order-1" });
    expect(order.status).toBe("cancelled");
  });

  it("arunca OrderTransitionError cand comanda e deja livrata/inchisa (OR001)", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "OR001", message: 'Comanda nu poate fi anulata din statusul "closed".' },
    });
    createClient.mockResolvedValue({ rpc });

    await expect(cancelOrder("order-1")).rejects.toBeInstanceOf(OrderTransitionError);
  });
});

describe("createOrderWithItems", () => {
  it("respinge o comanda fara linii, fara sa atinga baza de date", async () => {
    await expect(
      createOrderWithItems({
        organizationId: "org-1",
        clientId: "client-1",
        createdByAdmin: true,
        lines: [],
      }),
    ).rejects.toThrow(/cel puțin o linie/);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("creeaza comanda draft + liniile, in doua insert-uri", async () => {
    const orderSingle = vi
      .fn()
      .mockResolvedValue({ data: orderRow({ status: "draft", order_number: null }), error: null });
    const orderSelect = vi.fn().mockReturnValue({ single: orderSingle });
    const ordersInsert = vi.fn().mockReturnValue({ select: orderSelect });

    const itemsInsert = vi.fn().mockResolvedValue({ error: null });

    const from = vi.fn((table: string) => {
      if (table === "orders") return { insert: ordersInsert };
      if (table === "order_items") return { insert: itemsInsert };
      throw new Error(`tabel neasteptat in test: ${table}`);
    });
    createClient.mockResolvedValue({ from });

    const order = await createOrderWithItems({
      organizationId: "org-1",
      clientId: "client-1",
      createdByAdmin: true,
      deliveryDate: "2026-08-01",
      lines: [{ itemId: "item-1", quantity: 4 }],
    });

    expect(ordersInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        client_id: "client-1",
        created_by_admin: true,
        status: "draft",
        delivery_date: "2026-08-01",
      }),
    );
    expect(itemsInsert).toHaveBeenCalledWith([
      { organization_id: "org-1", order_id: "order-1", item_id: "item-1", quantity: 4 },
    ]);
    expect(order.status).toBe("draft");
  });

  it("sterge comanda deja creata (compensare) daca insertul liniilor esueaza", async () => {
    const orderSingle = vi
      .fn()
      .mockResolvedValue({ data: orderRow({ status: "draft" }), error: null });
    const ordersInsert = vi
      .fn()
      .mockReturnValue({ select: vi.fn().mockReturnValue({ single: orderSingle }) });

    const itemsInsert = vi.fn().mockResolvedValue({ error: { message: "constraint violation" } });

    const deleteEq = vi.fn().mockResolvedValue({ error: null });
    const ordersDelete = vi.fn().mockReturnValue({ eq: deleteEq });

    const from = vi.fn((table: string) => {
      if (table === "orders") return { insert: ordersInsert, delete: ordersDelete };
      if (table === "order_items") return { insert: itemsInsert };
      throw new Error(`tabel neasteptat in test: ${table}`);
    });
    createClient.mockResolvedValue({ from });

    await expect(
      createOrderWithItems({
        organizationId: "org-1",
        clientId: "client-1",
        createdByAdmin: true,
        lines: [{ itemId: "item-1", quantity: 4 }],
      }),
    ).rejects.toThrow(/liniile comenzii/);

    expect(ordersDelete).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith("id", "order-1");
  });
});
