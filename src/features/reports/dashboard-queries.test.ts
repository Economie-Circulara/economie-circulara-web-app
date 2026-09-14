import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { getDashboardKpis, getOperationalDashboard } from "./dashboard-queries";

/** Query builder fals, chainable, care rezolva la un rezultat `{ count, error }`. */
function makeCountBuilder(count: number, error: unknown = null) {
  const builder: Record<string, unknown> & { then: (resolve: (v: unknown) => void) => void } = {
    then: (resolve) => resolve({ count, error }),
  };
  for (const m of ["select", "in", "eq", "gte"]) {
    builder[m] = vi.fn(() => builder);
  }
  return builder;
}

function makeDataBuilder(data: unknown, count: number | null = null, error: unknown = null) {
  const builder: Record<string, unknown> & { then: (resolve: (v: unknown) => void) => void } = {
    then: (resolve) => resolve({ data, count, error }),
  };
  for (const method of ["select", "in", "eq", "gte", "order", "limit"]) {
    builder[method] = vi.fn(() => builder);
  }
  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getDashboardKpis", () => {
  it("combina cele 4 numarari in indicatorii de dashboard", async () => {
    // Ordinea de apel din sursa (Promise.all): active, de-acceptat, livrate, certificate.
    const builders = [
      makeCountBuilder(14), // comenzi active (sent/accepted/delivered)
      makeCountBuilder(3), // de acceptat (sent)
      makeCountBuilder(27), // livrate luna curenta
      makeCountBuilder(27), // certificate emise (total)
    ];
    let call = 0;
    const from = vi.fn(() => builders[call++]);
    createClient.mockResolvedValue({ from });

    const result = await getDashboardKpis();

    expect(result).toEqual({
      activeOrders: 14,
      ordersToAccept: 3,
      deliveredThisMonth: 27,
      certificatesIssued: 27,
    });
    expect(builders[0].in).toHaveBeenCalledWith("status", ["sent", "accepted", "delivered"]);
    expect(builders[1].eq).toHaveBeenCalledWith("status", "sent");
    expect(builders[2].eq).toHaveBeenCalledWith("status", "delivered");
    expect(builders[2].gte).toHaveBeenCalled();
  });

  it("intoarce 0 daca vreo numarare e null (fara randuri)", async () => {
    const builders = [
      makeCountBuilder(null as unknown as number),
      makeCountBuilder(null as unknown as number),
      makeCountBuilder(null as unknown as number),
      makeCountBuilder(null as unknown as number),
    ];
    let call = 0;
    createClient.mockResolvedValue({ from: vi.fn(() => builders[call++]) });

    const result = await getDashboardKpis();
    expect(result).toEqual({
      activeOrders: 0,
      ordersToAccept: 0,
      deliveredThisMonth: 0,
      certificatesIssued: 0,
    });
  });

  it("arunca eroare daca una dintre numarari esueaza", async () => {
    const builders = [
      makeCountBuilder(14),
      makeCountBuilder(0, { message: "boom" }),
      makeCountBuilder(27),
      makeCountBuilder(27),
    ];
    let call = 0;
    createClient.mockResolvedValue({ from: vi.fn(() => builders[call++]) });

    await expect(getDashboardKpis()).rejects.toThrow();
  });

  it("combina semnalele operationale cu KPI-urile, fara a ocoli RLS", async () => {
    const builders = [
      makeDataBuilder([
        {
          item_id: "item-1",
          initial_qty: 100,
          remaining_qty: 10,
          is_blocked: true,
          items: { title: "Granule reciclate", unit: "kg" },
        },
      ]),
      makeDataBuilder([
        {
          id: "order-1",
          order_number: "CMD-1",
          status: "sent",
          updated_at: "2026-09-14T10:00:00.000Z",
          clients: { name: "Client demo" },
        },
      ]),
      makeDataBuilder([
        { created_at: new Date().toISOString(), quantity: -5, items: { unit: "kg" } },
      ]),
      makeCountBuilder(4),
      makeCountBuilder(1),
      makeCountBuilder(2),
      makeCountBuilder(3),
    ];
    let call = 0;
    createClient.mockResolvedValue({ from: vi.fn(() => builders[call++]) });

    const result = await getOperationalDashboard();

    expect(result.kpis).toEqual({
      activeOrders: 4,
      ordersToAccept: 1,
      deliveredThisMonth: 2,
      certificatesIssued: 3,
    });
    expect(result.recentOrders).toMatchObject([{ id: "order-1", clientName: "Client demo" }]);
    expect(result.lowStockItems).toMatchObject([
      { itemId: "item-1", remainingQty: 10, availabilityPercent: 10 },
    ]);
    expect(result.blockedLots).toBe(1);
    expect(result.stockTrends[0]?.points.at(-1)?.quantity).toBe(10);
  });
});
