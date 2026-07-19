import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import {
  fetchDeliveredOrdersWithItems,
  fetchOrderStatusesCreatedInRange,
  fetchProcessInputsCompletedInRange,
  fetchRecycledLotsInRange,
  fetchReturnLinks,
} from "./repository";

/**
 * Query builder Supabase fals: chainable si "thenable", in stilul
 * `src/features/orders/queries.test.ts#makeQueryBuilder`.
 */
function makeQueryBuilder(finalResult: { data: unknown; error: unknown }) {
  const methods = ["select", "order", "eq", "in", "gte", "lte", "lt", "maybeSingle"] as const;
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

describe("fetchOrderStatusesCreatedInRange", () => {
  it("filtreaza pe created_at in interval si intoarce statusurile", async () => {
    const ordersBuilder = makeQueryBuilder({
      data: [{ status: "sent" }, { status: "accepted" }],
      error: null,
    });
    const from = vi.fn(() => ordersBuilder);
    createClient.mockResolvedValue({ from });

    const result = await fetchOrderStatusesCreatedInRange({ from: "2026-07-01", to: "2026-07-18" });

    expect(from).toHaveBeenCalledWith("orders");
    expect(ordersBuilder.gte).toHaveBeenCalledWith("created_at", "2026-07-01T00:00:00.000Z");
    expect(ordersBuilder.lt).toHaveBeenCalledWith("created_at", "2026-07-19T00:00:00.000Z");
    expect(result).toEqual([{ status: "sent" }, { status: "accepted" }]);
  });

  it("arunca eroare daca query-ul esueaza", async () => {
    const ordersBuilder = makeQueryBuilder({ data: null, error: { message: "boom" } });
    createClient.mockResolvedValue({ from: vi.fn(() => ordersBuilder) });
    await expect(
      fetchOrderStatusesCreatedInRange({ from: "2026-07-01", to: "2026-07-18" }),
    ).rejects.toThrow();
  });
});

describe("fetchDeliveredOrdersWithItems", () => {
  it("incarca comenzile delivered/closed + liniile lor, grupate pe comanda", async () => {
    const ordersBuilder = makeQueryBuilder({
      data: [
        {
          id: "order-1",
          order_number: "CMD-2026-0001",
          status: "delivered",
          client_id: "client-1",
          delivered_at: "2026-07-10T09:00:00.000Z",
          delivery_date: null,
          updated_at: "2026-07-10T00:00:00.000Z",
          clients: { name: "Construcții Apex SRL" },
        },
      ],
      error: null,
    });
    const itemsBuilder = makeQueryBuilder({
      data: [
        {
          order_id: "order-1",
          item_id: "item-1",
          quantity: 4000,
          items: { title: "Cărămidă eco", unit: "buc" },
        },
      ],
      error: null,
    });

    const from = vi.fn((table: string) => {
      if (table === "orders") return ordersBuilder;
      if (table === "order_items") return itemsBuilder;
      throw new Error(`tabel neasteptat: ${table}`);
    });
    createClient.mockResolvedValue({ from });

    const result = await fetchDeliveredOrdersWithItems();

    expect(ordersBuilder.in).toHaveBeenCalledWith("status", ["delivered", "closed"]);
    expect(itemsBuilder.in).toHaveBeenCalledWith("order_id", ["order-1"]);
    expect(result).toEqual([
      {
        id: "order-1",
        orderNumber: "CMD-2026-0001",
        status: "delivered",
        clientId: "client-1",
        clientName: "Construcții Apex SRL",
        deliveredAt: "2026-07-10T09:00:00.000Z",
        deliveryDate: null,
        updatedAt: "2026-07-10T00:00:00.000Z",
        items: [{ itemId: "item-1", itemTitle: "Cărămidă eco", unit: "buc", quantity: 4000 }],
      },
    ]);
  });
});

describe("fetchReturnLinks", () => {
  it("imbina order_links + comenzile originale/retur + liniile lor", async () => {
    const linksBuilder = makeQueryBuilder({
      data: [
        {
          id: "link-1",
          link_type: "return",
          created_at: "2026-07-05T00:00:00.000Z",
          original_order_id: "order-1",
          linked_order_id: "order-return-1",
        },
      ],
      error: null,
    });
    const ordersBuilder = makeQueryBuilder({
      data: [
        {
          id: "order-1",
          order_number: "CMD-2026-0001",
          status: "delivered",
          client_id: "client-1",
          updated_at: "2026-07-01T00:00:00.000Z",
          clients: { name: "Construcții Apex SRL" },
        },
        {
          id: "order-return-1",
          order_number: "CMD-2026-0002",
          status: "accepted",
          client_id: "client-1",
          updated_at: "2026-07-08T00:00:00.000Z",
          clients: { name: "Construcții Apex SRL" },
        },
      ],
      error: null,
    });
    const itemsBuilder = makeQueryBuilder({
      data: [
        {
          order_id: "order-return-1",
          item_id: "item-1",
          quantity: 200,
          items: { title: "Cărămidă eco", unit: "buc" },
        },
      ],
      error: null,
    });

    const from = vi.fn((table: string) => {
      if (table === "order_links") return linksBuilder;
      if (table === "orders") return ordersBuilder;
      if (table === "order_items") return itemsBuilder;
      throw new Error(`tabel neasteptat: ${table}`);
    });
    createClient.mockResolvedValue({ from });

    const result = await fetchReturnLinks();

    expect(linksBuilder.in).toHaveBeenCalledWith("link_type", ["return", "warranty"]);
    expect(result).toEqual([
      {
        linkId: "link-1",
        linkType: "return",
        linkCreatedAt: "2026-07-05T00:00:00.000Z",
        originalOrderId: "order-1",
        originalOrderNumber: "CMD-2026-0001",
        clientId: "client-1",
        clientName: "Construcții Apex SRL",
        returnOrderId: "order-return-1",
        returnOrderNumber: "CMD-2026-0002",
        returnOrderStatus: "accepted",
        returnOrderUpdatedAt: "2026-07-08T00:00:00.000Z",
        items: [{ itemId: "item-1", itemTitle: "Cărămidă eco", unit: "buc", quantity: 200 }],
      },
    ]);
  });

  it("intoarce lista goala fara sa mai interogheze restul tabelelor cand nu exista legaturi", async () => {
    const linksBuilder = makeQueryBuilder({ data: [], error: null });
    const from = vi.fn(() => linksBuilder);
    createClient.mockResolvedValue({ from });

    const result = await fetchReturnLinks();
    expect(result).toEqual([]);
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("fetchRecycledLotsInRange", () => {
  it("filtreaza loturile pe proveniente secundare si entry_date", async () => {
    const lotsBuilder = makeQueryBuilder({
      data: [
        {
          provenance: "recycling",
          item_id: "item-clay",
          initial_qty: 500,
          items: { title: "Argilă", unit: "kg" },
        },
      ],
      error: null,
    });
    createClient.mockResolvedValue({ from: vi.fn(() => lotsBuilder) });

    const result = await fetchRecycledLotsInRange({ from: "2026-07-01", to: "2026-07-18" });

    expect(lotsBuilder.in).toHaveBeenCalledWith("provenance", [
      "recycling",
      "reconditioning",
      "return",
    ]);
    expect(lotsBuilder.gte).toHaveBeenCalledWith("entry_date", "2026-07-01");
    expect(lotsBuilder.lte).toHaveBeenCalledWith("entry_date", "2026-07-18");
    expect(result).toEqual([
      {
        provenance: "recycling",
        itemId: "item-clay",
        itemTitle: "Argilă",
        unit: "kg",
        quantity: 500,
      },
    ]);
  });
});

describe("fetchProcessInputsCompletedInRange", () => {
  it("grupeaza inputurile de proces pe produsul de output", async () => {
    const processesBuilder = makeQueryBuilder({
      data: [{ id: "proc-1", output_item_id: "item-brick", items: { title: "Cărămidă eco" } }],
      error: null,
    });
    const inputsBuilder = makeQueryBuilder({
      data: [
        { process_id: "proc-1", quantity: 600, lots: { provenance: "recycling" } },
        { process_id: "proc-1", quantity: 400, lots: { provenance: "purchase" } },
      ],
      error: null,
    });

    const from = vi.fn((table: string) => {
      if (table === "processes") return processesBuilder;
      if (table === "process_inputs") return inputsBuilder;
      throw new Error(`tabel neasteptat: ${table}`);
    });
    createClient.mockResolvedValue({ from });

    const result = await fetchProcessInputsCompletedInRange({
      from: "2026-07-01",
      to: "2026-07-18",
    });

    expect(processesBuilder.eq).toHaveBeenCalledWith("status", "completed");
    expect(result).toEqual([
      {
        productItemId: "item-brick",
        productTitle: "Cărămidă eco",
        provenance: "recycling",
        quantity: 600,
      },
      {
        productItemId: "item-brick",
        productTitle: "Cărămidă eco",
        provenance: "purchase",
        quantity: 400,
      },
    ]);
  });

  it("intoarce lista goala fara procese finalizate in perioada", async () => {
    const processesBuilder = makeQueryBuilder({ data: [], error: null });
    createClient.mockResolvedValue({ from: vi.fn(() => processesBuilder) });

    const result = await fetchProcessInputsCompletedInRange({
      from: "2026-07-01",
      to: "2026-07-18",
    });
    expect(result).toEqual([]);
  });
});
