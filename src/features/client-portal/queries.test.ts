import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies - vezi AGENTS.md §2.2): inlocuim complet clientul Supabase server.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { getClientOrderDelivery, listCatalogItems } from "./queries";

/**
 * Query builder Supabase fals: chainable ("thenable"), acelasi stil ca
 * `src/features/items/queries.test.ts#makeQueryBuilder`.
 */
function makeQueryBuilder(finalResult: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> & { then: (resolve: (v: unknown) => void) => void } = {
    then: (resolve) => resolve(finalResult),
  };
  for (const m of ["select", "order", "eq", "ilike", "is"]) {
    builder[m] = vi.fn(() => builder);
  }
  return builder;
}

afterEach(() => {
  vi.clearAllMocks();
});

function itemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    title: "Cărămidă eco",
    description: "Cărămidă din materiale reciclate",
    unit: "bucata",
    kind: "physical",
    image_url: null,
    ...overrides,
  };
}

describe("listCatalogItems", () => {
  it("filtreaza mereu dupa sellable=true (gating pret/stoc - catalogul clientului)", async () => {
    const builder = makeQueryBuilder({ data: [itemRow()], error: null });
    const from = vi.fn().mockReturnValue(builder);
    createClient.mockResolvedValue({ from });

    await listCatalogItems();

    expect(from).toHaveBeenCalledWith("items");
    expect(builder.select).toHaveBeenCalledWith("id, title, description, unit, kind, image_url");
    expect(builder.eq).toHaveBeenCalledWith("sellable", true);
  });

  it("mapeaza randurile in CatalogItem (fara camp de pret/stoc)", async () => {
    const builder = makeQueryBuilder({ data: [itemRow()], error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    const result = await listCatalogItems();

    expect(result).toEqual([
      {
        id: "item-1",
        title: "Cărămidă eco",
        description: "Cărămidă din materiale reciclate",
        unit: "bucata",
        kind: "physical",
        imageUrl: null,
      },
    ]);
    expect(result[0]).not.toHaveProperty("price");
    expect(result[0]).not.toHaveProperty("stock");
  });

  it("aplica filtrul de tip si cautare", async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await listCatalogItems({ kind: "service", search: "eco" });

    expect(builder.eq).toHaveBeenCalledWith("kind", "service");
    expect(builder.ilike).toHaveBeenCalledWith("title", "%eco%");
  });

  it("arunca eroare cand interogarea esueaza", async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: "db down" } });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await expect(listCatalogItems()).rejects.toThrow("Nu am putut încărca catalogul.");
  });
});

describe("listCatalogItems - itemi arhivati (migrarea 0035)", () => {
  it("nu mai arata in catalog itemii arhivati", async () => {
    const builder = makeQueryBuilder({ data: [], error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await listCatalogItems();

    expect(builder.is).toHaveBeenCalledWith("archived_at", null);
  });
});

describe("getClientOrderDelivery", () => {
  function mockRpc(result: { data: unknown; error: unknown }) {
    const rpc = vi.fn(() => Promise.resolve(result));
    createClient.mockResolvedValue({ rpc });
    return rpc;
  }

  it("apeleaza RPC-ul client_order_delivery si mapeaza randul", async () => {
    const rpc = mockRpc({
      data: [
        {
          scheduled_date: "2026-10-04",
          carrier_name: "Fan Courier",
          vehicle_plate: "B33GRD",
          driver_name: "Ionel Mihai",
          route_destination: "Iași, Strada Otilia Cazimir 1",
          uit_code: null,
          received_at: null,
          received_by_name: null,
        },
      ],
      error: null,
    });

    const delivery = await getClientOrderDelivery("order-1");

    expect(rpc).toHaveBeenCalledWith("client_order_delivery", { p_order_id: "order-1" });
    expect(delivery).toEqual({
      scheduledDate: "2026-10-04",
      carrierName: "Fan Courier",
      vehiclePlate: "B33GRD",
      driverName: "Ionel Mihai",
      destination: "Iași, Strada Otilia Cazimir 1",
      uitCode: null,
      receivedAt: null,
      receivedByName: null,
    });
  });

  it("intoarce null cand comanda nu are livrare activa", async () => {
    mockRpc({ data: [], error: null });
    await expect(getClientOrderDelivery("order-1")).resolves.toBeNull();
  });

  it("arunca o eroare RO cand RPC-ul esueaza", async () => {
    mockRpc({ data: null, error: { message: "boom" } });
    await expect(getClientOrderDelivery("order-1")).rejects.toThrow(
      "Nu am putut încărca detaliile livrării.",
    );
  });
});
