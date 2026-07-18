import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { getOrderDetail, getOrderStatus, listOrders } from "./queries";

/**
 * Query builder Supabase fals: chainable si "thenable", in stilul
 * `src/features/stock/queries.test.ts#makeQueryBuilder`.
 */
function makeQueryBuilder(finalResult: { data: unknown; error: unknown }) {
  const methods = ["select", "order", "eq", "in", "maybeSingle"] as const;
  const builder: Record<string, unknown> & { then: (resolve: (v: unknown) => void) => void } = {
    then: (resolve) => resolve(finalResult),
  };
  for (const m of methods) {
    if (m === "maybeSingle") {
      builder[m] = vi.fn().mockResolvedValue(finalResult);
    } else {
      builder[m] = vi.fn(() => builder);
    }
  }
  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("listOrders", () => {
  it("mapeaza comenzile + rezumatul liniilor si filtreaza dupa status", async () => {
    const ordersBuilder = makeQueryBuilder({
      data: [
        {
          id: "order-1",
          client_id: "client-1",
          order_number: "CMD-2026-0001",
          status: "sent",
          created_by_admin: true,
          delivery_address_id: null,
          delivery_date: "2026-08-01",
          expected_return_date: null,
          notes: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
          clients: { name: "Construcții Apex SRL" },
        },
      ],
      error: null,
    });
    const itemsBuilder = makeQueryBuilder({
      data: [
        { order_id: "order-1", quantity: 4, items: { title: "Cărămidă eco" } },
        { order_id: "order-1", quantity: 2, items: { title: "Pavaj" } },
      ],
      error: null,
    });

    const from = vi.fn((table: string) => {
      if (table === "orders") return ordersBuilder;
      if (table === "order_items") return itemsBuilder;
      throw new Error(`tabel neasteptat: ${table}`);
    });
    createClient.mockResolvedValue({ from });

    const result = await listOrders({ status: "sent" });

    expect(ordersBuilder.eq).toHaveBeenCalledWith("status", "sent");
    expect(itemsBuilder.in).toHaveBeenCalledWith("order_id", ["order-1"]);
    expect(result).toEqual([
      expect.objectContaining({
        id: "order-1",
        clientName: "Construcții Apex SRL",
        itemsSummary: "Cărămidă eco ×4, Pavaj ×2",
        status: "sent",
      }),
    ]);
  });

  it("filtreaza (in JS) dupa client sau numar de comanda cand e dat `search`", async () => {
    const ordersBuilder = makeQueryBuilder({
      data: [
        {
          id: "order-1",
          client_id: "client-1",
          order_number: "CMD-2026-0001",
          status: "draft",
          created_by_admin: false,
          delivery_address_id: null,
          delivery_date: null,
          expected_return_date: null,
          notes: null,
          created_at: "2026-07-01T00:00:00.000Z",
          updated_at: "2026-07-01T00:00:00.000Z",
          clients: { name: "Verde Habitat SA" },
        },
        {
          id: "order-2",
          client_id: "client-2",
          order_number: "CMD-2026-0002",
          status: "draft",
          created_by_admin: false,
          delivery_address_id: null,
          delivery_date: null,
          expected_return_date: null,
          notes: null,
          created_at: "2026-07-02T00:00:00.000Z",
          updated_at: "2026-07-02T00:00:00.000Z",
          clients: { name: "Domus Renova SRL" },
        },
      ],
      error: null,
    });
    const itemsBuilder = makeQueryBuilder({ data: [], error: null });

    const from = vi.fn((table: string) => (table === "orders" ? ordersBuilder : itemsBuilder));
    createClient.mockResolvedValue({ from });

    const result = await listOrders({ search: "verde" });

    expect(result).toHaveLength(1);
    expect(result[0]?.clientName).toBe("Verde Habitat SA");
  });

  it("arunca eroare cand interogarea comenzilor esueaza", async () => {
    const ordersBuilder = makeQueryBuilder({ data: null, error: { message: "db down" } });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(ordersBuilder) });

    await expect(listOrders()).rejects.toThrow("Nu am putut incarca lista de comenzi.");
  });
});

describe("getOrderStatus", () => {
  it("returneaza statusul comenzii", async () => {
    const builder = makeQueryBuilder({ data: { status: "accepted" }, error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await expect(getOrderStatus("order-1")).resolves.toBe("accepted");
  });

  it("returneaza null cand comanda nu exista/nu e accesibila", async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await expect(getOrderStatus("order-x")).resolves.toBeNull();
  });
});

describe("getOrderDetail", () => {
  it("returneaza null cand comanda nu exista/nu e accesibila (RLS)", async () => {
    const builder = makeQueryBuilder({ data: null, error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await expect(getOrderDetail("order-x")).resolves.toBeNull();
  });

  it("mapeaza comanda + client + adresa + linii", async () => {
    const orderBuilder = makeQueryBuilder({
      data: {
        id: "order-1",
        client_id: "client-1",
        order_number: "CMD-2026-0001",
        status: "sent",
        created_by_admin: true,
        delivery_address_id: "addr-1",
        delivery_date: "2026-08-01",
        expected_return_date: null,
        notes: "livrare rapidă",
        created_at: "2026-07-01T00:00:00.000Z",
        updated_at: "2026-07-01T00:00:00.000Z",
        clients: { name: "Construcții Apex SRL", cui: "RO14820391" },
        client_addresses: { address: "Str. Exemplu 1", label: "Depozit" },
      },
      error: null,
    });
    const itemsBuilder = makeQueryBuilder({
      data: [
        {
          id: "item-row-1",
          item_id: "item-1",
          quantity: 4,
          items: { title: "Cărămidă eco", unit: "bucata" },
        },
      ],
      error: null,
    });

    const from = vi.fn((table: string) => (table === "orders" ? orderBuilder : itemsBuilder));
    createClient.mockResolvedValue({ from });

    const result = await getOrderDetail("order-1");

    expect(result).toMatchObject({
      id: "order-1",
      clientName: "Construcții Apex SRL",
      clientCui: "RO14820391",
      deliveryAddressLabel: "Depozit",
      deliveryAddress: "Str. Exemplu 1",
      items: [{ itemId: "item-1", itemTitle: "Cărămidă eco", unit: "bucata", quantity: 4 }],
    });
  });
});
