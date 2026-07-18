import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies — vezi AGENTS.md §2.2).
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { getReturnableItems } = vi.hoisted(() => ({ getReturnableItems: vi.fn() }));
vi.mock("./queries", () => ({ getReturnableItems }));

import {
  ReturnNotFoundError,
  ReturnPermissionError,
  ReturnTransitionError,
  ReturnValidationError,
  acceptReturnOrder,
  createReturnOrder,
  loadOriginalOrderForReturn,
} from "./service";

afterEach(() => {
  vi.clearAllMocks();
});

function orderRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-orig",
    organization_id: "org-1",
    client_id: "client-1",
    order_number: "CMD-2026-0001",
    status: "delivered",
    ...overrides,
  };
}

describe("loadOriginalOrderForReturn", () => {
  it("arunca ReturnNotFoundError cand comanda nu exista (sau nu e accesibila prin RLS)", async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi
          .fn()
          .mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }) }),
      }),
    });
    createClient.mockResolvedValue({ from });

    await expect(loadOriginalOrderForReturn("order-x")).rejects.toBeInstanceOf(ReturnNotFoundError);
  });

  it("arunca ReturnValidationError cand comanda nu e livrata/inchisa", async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: orderRow({ status: "accepted" }), error: null }),
        }),
      }),
    });
    createClient.mockResolvedValue({ from });

    await expect(loadOriginalOrderForReturn("order-orig")).rejects.toBeInstanceOf(
      ReturnValidationError,
    );
  });

  it("returneaza comanda cand e livrata/inchisa", async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          maybeSingle: vi
            .fn()
            .mockResolvedValue({ data: orderRow({ status: "closed" }), error: null }),
        }),
      }),
    });
    createClient.mockResolvedValue({ from });

    const result = await loadOriginalOrderForReturn("order-orig");

    expect(result).toEqual({
      id: "order-orig",
      organizationId: "org-1",
      clientId: "client-1",
      orderNumber: "CMD-2026-0001",
      status: "closed",
    });
  });
});

/** Mock-uieste `createClient` pt. fluxul de creare: select comanda originala + insert-urile ulterioare. */
function mockCreateClientForCreate(options: {
  originalOrder?: Record<string, unknown>;
  returnOrderRow?: Record<string, unknown>;
  replacementOrderRow?: Record<string, unknown>;
  itemsInsertError?: { message: string } | null;
  linkInsertError?: { message: string } | null;
  replacementItemsInsertError?: { message: string } | null;
  replacementLinkInsertError?: { message: string } | null;
}) {
  const deleteEq = vi.fn().mockResolvedValue({ error: null });
  const ordersDelete = vi.fn().mockReturnValue({ eq: deleteEq });

  let ordersInsertCall = 0;
  const ordersInsert = vi.fn(() => {
    ordersInsertCall++;
    const row =
      ordersInsertCall === 1
        ? (options.returnOrderRow ?? { id: "return-1" })
        : (options.replacementOrderRow ?? { id: "replacement-1" });
    return {
      select: vi
        .fn()
        .mockReturnValue({ single: vi.fn().mockResolvedValue({ data: row, error: null }) }),
    };
  });

  let itemsInsertCall = 0;
  const itemsInsert = vi.fn(() => {
    itemsInsertCall++;
    if (itemsInsertCall === 1) {
      return Promise.resolve({ error: options.itemsInsertError ?? null });
    }
    return Promise.resolve({ error: options.replacementItemsInsertError ?? null });
  });

  let linksInsertCall = 0;
  const linksInsert = vi.fn(() => {
    linksInsertCall++;
    if (linksInsertCall === 1) {
      return Promise.resolve({ error: options.linkInsertError ?? null });
    }
    return Promise.resolve({ error: options.replacementLinkInsertError ?? null });
  });

  const from = vi.fn((table: string) => {
    if (table === "orders") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi
              .fn()
              .mockResolvedValue({ data: options.originalOrder ?? orderRow(), error: null }),
          }),
        }),
        insert: ordersInsert,
        delete: ordersDelete,
      };
    }
    if (table === "order_items") return { insert: itemsInsert };
    if (table === "order_links") return { insert: linksInsert };
    throw new Error(`tabel neasteptat in test: ${table}`);
  });

  createClient.mockResolvedValue({ from });
  return { ordersInsert, itemsInsert, linksInsert, ordersDelete, deleteEq };
}

describe("createReturnOrder", () => {
  it("respinge o cerere fara linii, fara sa atinga baza de date", async () => {
    await expect(
      createReturnOrder({
        originalOrderId: "order-orig",
        type: "return",
        items: [],
        createdByAdmin: true,
      }),
    ).rejects.toBeInstanceOf(ReturnValidationError);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("respinge o cantitate mai mare decat cea returnabila", async () => {
    mockCreateClientForCreate({});
    getReturnableItems.mockResolvedValue([
      {
        orderItemId: "oi-1",
        itemId: "item-1",
        itemTitle: "Cărămidă eco",
        unit: "buc",
        orderedQuantity: 10,
        alreadyReturnedQuantity: 8,
        returnableQuantity: 2,
      },
    ]);

    await expect(
      createReturnOrder({
        originalOrderId: "order-orig",
        type: "return",
        items: [{ orderItemId: "oi-1", quantity: 5 }],
        createdByAdmin: true,
      }),
    ).rejects.toBeInstanceOf(ReturnValidationError);
  });

  it("creeaza comanda-retur + liniile + order_links (tip 'return')", async () => {
    const { ordersInsert, itemsInsert, linksInsert } = mockCreateClientForCreate({
      returnOrderRow: { id: "return-1" },
    });
    getReturnableItems.mockResolvedValue([
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

    const result = await createReturnOrder({
      originalOrderId: "order-orig",
      type: "return",
      items: [{ orderItemId: "oi-1", quantity: 4 }],
      createdByAdmin: false,
    });

    expect(ordersInsert).toHaveBeenCalledTimes(1);
    expect(ordersInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        organization_id: "org-1",
        client_id: "client-1",
        created_by_admin: false,
        status: "draft",
      }),
    );
    expect(itemsInsert).toHaveBeenCalledWith([
      { organization_id: "org-1", order_id: "return-1", item_id: "item-1", quantity: 4 },
    ]);
    expect(linksInsert).toHaveBeenCalledWith({
      organization_id: "org-1",
      link_type: "return",
      original_order_id: "order-orig",
      linked_order_id: "return-1",
    });
    expect(result).toEqual({ returnOrderId: "return-1", replacementOrderId: null });
  });

  it("garanție: creeaza si comanda de inlocuire + order_links tip 'replacement'", async () => {
    const { ordersInsert, linksInsert } = mockCreateClientForCreate({
      returnOrderRow: { id: "return-1" },
      replacementOrderRow: { id: "replacement-1" },
    });
    getReturnableItems.mockResolvedValue([
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

    const result = await createReturnOrder({
      originalOrderId: "order-orig",
      type: "warranty",
      items: [{ orderItemId: "oi-1", quantity: 3 }],
      createdByAdmin: true,
    });

    expect(ordersInsert).toHaveBeenCalledTimes(2);
    expect(linksInsert).toHaveBeenNthCalledWith(2, {
      organization_id: "org-1",
      link_type: "replacement",
      original_order_id: "order-orig",
      linked_order_id: "replacement-1",
    });
    expect(result).toEqual({ returnOrderId: "return-1", replacementOrderId: "replacement-1" });
  });

  it("sterge comanda-retur deja creata (compensare) daca insertul liniilor esueaza", async () => {
    const { ordersDelete, deleteEq } = mockCreateClientForCreate({
      returnOrderRow: { id: "return-1" },
      itemsInsertError: { message: "constraint violation" },
    });
    getReturnableItems.mockResolvedValue([
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

    await expect(
      createReturnOrder({
        originalOrderId: "order-orig",
        type: "return",
        items: [{ orderItemId: "oi-1", quantity: 4 }],
        createdByAdmin: true,
      }),
    ).rejects.toThrow(/liniile comenzii de retur/);

    expect(ordersDelete).toHaveBeenCalled();
    expect(deleteEq).toHaveBeenCalledWith("id", "return-1");
  });
});

describe("acceptReturnOrder", () => {
  it("apeleaza RPC accept_return_order si returneaza comanda acceptata", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({
        data: { ...orderRow({ status: "accepted" }), id: "return-1" },
        error: null,
      });
    createClient.mockResolvedValue({ rpc });

    const order = await acceptReturnOrder("return-1");

    expect(rpc).toHaveBeenCalledWith("accept_return_order", { p_return_order_id: "return-1" });
    expect(order.status).toBe("accepted");
  });

  it("arunca ReturnNotFoundError cand RPC raporteaza RT002", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "RT002", message: "not found" } });
    createClient.mockResolvedValue({ rpc });

    await expect(acceptReturnOrder("return-x")).rejects.toBeInstanceOf(ReturnNotFoundError);
  });

  it("arunca ReturnValidationError cand RPC raporteaza RT003 (nu e comanda-retur)", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "RT003", message: "not a return order" } });
    createClient.mockResolvedValue({ rpc });

    await expect(acceptReturnOrder("order-1")).rejects.toBeInstanceOf(ReturnValidationError);
  });

  it("arunca ReturnTransitionError cand RPC raporteaza RT001 (deja acceptata)", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "RT001", message: "already accepted" } });
    createClient.mockResolvedValue({ rpc });

    await expect(acceptReturnOrder("return-1")).rejects.toBeInstanceOf(ReturnTransitionError);
  });

  it("arunca ReturnPermissionError cand RPC raporteaza RT004 (client incearca sa accepte)", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { code: "RT004", message: "forbidden" } });
    createClient.mockResolvedValue({ rpc });

    await expect(acceptReturnOrder("return-1")).rejects.toBeInstanceOf(ReturnPermissionError);
  });
});
