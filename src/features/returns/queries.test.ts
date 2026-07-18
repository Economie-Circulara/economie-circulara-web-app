import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies — vezi AGENTS.md §2.2): inlocuim complet clientul Supabase server.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { getReturnableItems, getReturnLinkForOrder } from "./queries";

afterEach(() => {
  vi.clearAllMocks();
});

function itemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "oi-1",
    item_id: "item-1",
    quantity: 10,
    items: { title: "Cărămidă eco", unit: "buc" },
    ...overrides,
  };
}

/**
 * Construieste un `from` dispatcher care raspunde diferit la a doua interogare
 * pe acelasi tabel (ex. `orders` e interogat o data pt. "exista comanda?" si a
 * doua oara pt. statusul comenzilor-retur legate; `order_items` e interogat o
 * data pt. liniile comenzii si a doua oara pt. cantitatile deja returnate).
 */
function buildFrom(config: {
  order: { data: unknown; error?: unknown };
  orderItems: { data: unknown; error?: unknown };
  orderLinks: { data: unknown; error?: unknown };
  linkedOrders?: { data: unknown; error?: unknown };
  returnedItems?: { data: unknown; error?: unknown };
}) {
  let ordersCall = 0;
  let itemsCall = 0;

  return vi.fn((table: string) => {
    if (table === "orders") {
      ordersCall++;
      if (ordersCall === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue(config.order),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue(config.linkedOrders ?? { data: [], error: null }),
        }),
      };
    }
    if (table === "order_items") {
      itemsCall++;
      if (itemsCall === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue(config.orderItems),
            }),
          }),
        };
      }
      return {
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue(config.returnedItems ?? { data: [], error: null }),
        }),
      };
    }
    if (table === "order_links") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue(config.orderLinks),
          }),
        }),
      };
    }
    throw new Error(`tabel neasteptat in test: ${table}`);
  });
}

describe("getReturnableItems", () => {
  it("comanda inexistentă (sau fără acces RLS) -> listă goală", async () => {
    const from = buildFrom({
      order: { data: null },
      orderItems: { data: [] },
      orderLinks: { data: [] },
    });
    createClient.mockResolvedValue({ from });

    const result = await getReturnableItems("order-x");

    expect(result).toEqual([]);
  });

  it("fără retururi anterioare -> tot cantitatea originală e returnabilă", async () => {
    const from = buildFrom({
      order: { data: { id: "order-1" } },
      orderItems: { data: [itemRow({ quantity: 10 })] },
      orderLinks: { data: [] },
    });
    createClient.mockResolvedValue({ from });

    const result = await getReturnableItems("order-1");

    expect(result).toEqual([
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
  });

  it("retur parțial deja acceptat -> scade din cantitatea returnabilă", async () => {
    const from = buildFrom({
      order: { data: { id: "order-1" } },
      orderItems: { data: [itemRow({ quantity: 10 })] },
      orderLinks: { data: [{ linked_order_id: "return-1" }] },
      linkedOrders: { data: [{ id: "return-1", status: "accepted" }] },
      returnedItems: { data: [{ item_id: "item-1", quantity: 4 }] },
    });
    createClient.mockResolvedValue({ from });

    const [result] = await getReturnableItems("order-1");

    expect(result.alreadyReturnedQuantity).toBe(4);
    expect(result.returnableQuantity).toBe(6);
  });

  it("retur dublu (doua comenzi-retur legate) -> se insumeaza ambele", async () => {
    const from = buildFrom({
      order: { data: { id: "order-1" } },
      orderItems: { data: [itemRow({ quantity: 10 })] },
      orderLinks: { data: [{ linked_order_id: "return-1" }, { linked_order_id: "return-2" }] },
      linkedOrders: {
        data: [
          { id: "return-1", status: "accepted" },
          { id: "return-2", status: "draft" },
        ],
      },
      returnedItems: {
        data: [
          { item_id: "item-1", quantity: 4 },
          { item_id: "item-1", quantity: 3 },
        ],
      },
    });
    createClient.mockResolvedValue({ from });

    const [result] = await getReturnableItems("order-1");

    expect(result.alreadyReturnedQuantity).toBe(7);
    expect(result.returnableQuantity).toBe(3);
  });

  it("comanda-retur anulată nu mai blochează cantitatea (exclusă din calcul)", async () => {
    const from = buildFrom({
      order: { data: { id: "order-1" } },
      orderItems: { data: [itemRow({ quantity: 10 })] },
      orderLinks: { data: [{ linked_order_id: "return-1" }] },
      linkedOrders: { data: [{ id: "return-1", status: "cancelled" }] },
    });
    createClient.mockResolvedValue({ from });

    const [result] = await getReturnableItems("order-1");

    expect(result.alreadyReturnedQuantity).toBe(0);
    expect(result.returnableQuantity).toBe(10);
  });

  it("cantitatea returnabilă nu scade sub zero (clamped)", async () => {
    const from = buildFrom({
      order: { data: { id: "order-1" } },
      orderItems: { data: [itemRow({ quantity: 10 })] },
      orderLinks: { data: [{ linked_order_id: "return-1" }] },
      linkedOrders: { data: [{ id: "return-1", status: "accepted" }] },
      returnedItems: { data: [{ item_id: "item-1", quantity: 10 }] },
    });
    createClient.mockResolvedValue({ from });

    const [result] = await getReturnableItems("order-1");

    expect(result.returnableQuantity).toBe(0);
  });
});

describe("getReturnLinkForOrder", () => {
  it("intoarce null cand comanda nu e o comanda-retur/garanție/inlocuire", async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi
          .fn()
          .mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      }),
    });
    createClient.mockResolvedValue({ from });

    const result = await getReturnLinkForOrder("order-1");

    expect(result).toBeNull();
  });

  it("intoarce tipul legăturii + comanda originală cand există", async () => {
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: [{ link_type: "warranty", original_order_id: "order-orig" }],
            error: null,
          }),
        }),
      }),
    });
    createClient.mockResolvedValue({ from });

    const result = await getReturnLinkForOrder("order-1");

    expect(result).toEqual({ linkType: "warranty", originalOrderId: "order-orig" });
  });
});
