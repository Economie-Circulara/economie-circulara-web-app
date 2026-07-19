import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies — AGENTS.md §2.2): inlocuim complet clientul Supabase server +
// functiile reutilizate din alte feature-uri (orders/clients/items/client-portal).
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { listOrders } = vi.hoisted(() => ({ listOrders: vi.fn() }));
vi.mock("@/features/orders/queries", () => ({ listOrders }));

const { listClients } = vi.hoisted(() => ({ listClients: vi.fn() }));
vi.mock("@/features/clients/queries", () => ({ listClients }));

const { listItems } = vi.hoisted(() => ({ listItems: vi.fn() }));
vi.mock("@/features/items/queries", () => ({ listItems }));

const { listCatalogItems } = vi.hoisted(() => ({ listCatalogItems: vi.fn() }));
vi.mock("@/features/client-portal/queries", () => ({ listCatalogItems }));

import { globalSearch, toIlikePattern } from "./service";

afterEach(() => {
  vi.clearAllMocks();
});

/** Obiect chainable minimal ce imita `PostgrestFilterBuilder` (orice metoda intoarce
 * acelasi obiect, si e "thenable" — se poate `await`-a in orice punct al lantului). */
function chainable(result: { data: unknown; error: unknown }) {
  const obj: Record<string, unknown> = {
    select: vi.fn(() => obj),
    ilike: vi.fn(() => obj),
    in: vi.fn(() => obj),
    order: vi.fn(() => obj),
    limit: vi.fn(() => obj),
    then: (onFulfilled: (value: typeof result) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
  };
  return obj;
}

function makeSupabase(overrides: {
  items?: unknown[];
  lots?: unknown[];
  certificates?: unknown[];
}) {
  const from = vi.fn((table: string) => {
    if (table === "items") return chainable({ data: overrides.items ?? [], error: null });
    if (table === "lots") return chainable({ data: overrides.lots ?? [], error: null });
    if (table === "certificates") {
      return chainable({ data: overrides.certificates ?? [], error: null });
    }
    throw new Error(`tabel neasteptat in test: ${table}`);
  });
  return { from };
}

function orderListRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "order-1",
    clientId: "client-1",
    orderNumber: "CMD-2026-0001",
    status: "sent",
    createdByAdmin: true,
    deliveryAddressId: null,
    deliveryDate: null,
    expectedReturnDate: null,
    notes: null,
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    clientName: "SC Exemplu SRL",
    itemsSummary: "Cărămidă eco ×4.000",
    ...overrides,
  };
}

describe("toIlikePattern", () => {
  it("incadreaza inputul intre %...%", () => {
    expect(toIlikePattern("moloz")).toBe("%moloz%");
  });

  it("escapeaza metacaracterele ilike (%, _)", () => {
    expect(toIlikePattern("50%_off")).toBe("%50\\%\\_off%");
  });

  it("nu altereaza input fara metacaractere", () => {
    expect(toIlikePattern("CMD-2026")).toBe("%CMD-2026%");
  });
});

describe("globalSearch — query goala", () => {
  it("returneaza [] fara sa interogheze nimic", async () => {
    const result = await globalSearch("   ", { role: "admin" });
    expect(result).toEqual([]);
    expect(listOrders).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("globalSearch — rol staff (admin/operator)", () => {
  it("interogheaza toate cele 5 entitati si NU catalogul clientului", async () => {
    listOrders.mockResolvedValue([orderListRow()]);
    listClients.mockResolvedValue([]);
    listItems.mockResolvedValue([]);
    const supabase = makeSupabase({ items: [{ id: "item-1" }] });
    createClient.mockResolvedValue(supabase);

    await globalSearch("moloz", { role: "admin" });

    expect(listOrders).toHaveBeenCalledWith({ search: "moloz" });
    expect(listClients).toHaveBeenCalledWith({ search: "moloz" });
    expect(listItems).toHaveBeenCalledWith({ search: "moloz" });
    expect(listCatalogItems).not.toHaveBeenCalled();

    const tablesQueried = supabase.from.mock.calls.map((call) => call[0]);
    expect(tablesQueried).toContain("items");
    expect(tablesQueried).toContain("lots");
    expect(tablesQueried).toContain("certificates");
  });

  it("grupeaza rezultatele in ordinea comanda/client/lot/produs/certificat, omitand grupurile goale", async () => {
    listOrders.mockResolvedValue([orderListRow()]);
    listClients.mockResolvedValue([]); // grup gol -> omis
    listItems.mockResolvedValue([]); // grup gol -> omis
    const supabase = makeSupabase({
      items: [], // fara itemi potriviti -> fara loturi (grup gol -> omis)
      certificates: [
        {
          id: "cert-1",
          number: "CERT-2026-0001",
          order_id: "order-1",
          orders: { order_number: "CMD-2026-0001" },
        },
      ],
    });
    createClient.mockResolvedValue(supabase);

    const groups = await globalSearch("cmd", { role: "operator" });

    expect(groups.map((g) => g.type)).toEqual(["order", "certificate"]);
    expect(groups[0].results[0]).toMatchObject({
      type: "order",
      id: "order-1",
      label: "CMD-2026-0001",
      href: "/comenzi/order-1",
    });
    expect(groups[1].results[0]).toMatchObject({
      type: "certificate",
      id: "cert-1",
      label: "CERT-2026-0001",
      sublabel: "CMD-2026-0001",
      href: "/comenzi/order-1/certificat",
    });
  });

  it("cauta loturile prin item (doi pasi: items apoi lots), cu link catre /stoc?item_id=", async () => {
    listOrders.mockResolvedValue([]);
    listClients.mockResolvedValue([]);
    listItems.mockResolvedValue([]);
    const supabase = makeSupabase({
      items: [{ id: "item-1" }],
      lots: [
        {
          id: "lot-1",
          item_id: "item-1",
          source: "Demolare șantier X",
          entry_date: "2026-06-01",
          items: { title: "Moloz beton" },
        },
      ],
    });
    createClient.mockResolvedValue(supabase);

    const groups = await globalSearch("moloz", { role: "admin" });

    const lotGroup = groups.find((g) => g.type === "lot");
    expect(lotGroup?.results[0]).toMatchObject({
      id: "lot-1",
      label: "Moloz beton",
      href: "/stoc?item_id=item-1",
    });
  });

  it("respecta limita per entitate (implicit 5)", async () => {
    listOrders.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) =>
        orderListRow({ id: `order-${i}`, orderNumber: `CMD-${i}` }),
      ),
    );
    listClients.mockResolvedValue([]);
    listItems.mockResolvedValue([]);
    createClient.mockResolvedValue(makeSupabase({}));

    const groups = await globalSearch("cmd", { role: "admin" });

    expect(groups.find((g) => g.type === "order")?.results).toHaveLength(5);
  });
});

describe("globalSearch — rol client", () => {
  it("NU interogheaza clients/lots (nici service-ul, nici tabelele) — doar comenzi/certificate/catalog proprii", async () => {
    listOrders.mockResolvedValue([orderListRow()]);
    listCatalogItems.mockResolvedValue([]);
    const supabase = makeSupabase({
      certificates: [
        {
          id: "cert-1",
          number: "CERT-1",
          order_id: "order-1",
          orders: { order_number: "CMD-2026-0001" },
        },
      ],
    });
    createClient.mockResolvedValue(supabase);

    await globalSearch("cmd", { role: "client" });

    expect(listOrders).toHaveBeenCalledWith({ search: "cmd" });
    expect(listCatalogItems).toHaveBeenCalledWith({ search: "cmd" });
    expect(listClients).not.toHaveBeenCalled();
    expect(listItems).not.toHaveBeenCalled();

    const tablesQueried = supabase.from.mock.calls.map((call) => call[0]);
    expect(tablesQueried).not.toContain("lots");
    expect(tablesQueried).not.toContain("items");
  });

  it("foloseste rutele /comenzile-mele pentru comenzi si certificate", async () => {
    listOrders.mockResolvedValue([orderListRow()]);
    listCatalogItems.mockResolvedValue([{ id: "item-1", title: "Cărămidă eco", unit: "buc" }]);
    createClient.mockResolvedValue(
      makeSupabase({
        certificates: [
          {
            id: "cert-1",
            number: "CERT-1",
            order_id: "order-1",
            orders: { order_number: "CMD-1" },
          },
        ],
      }),
    );

    const groups = await globalSearch("cmd", { role: "client" });

    const orderGroup = groups.find((g) => g.type === "order");
    const certGroup = groups.find((g) => g.type === "certificate");
    const itemGroup = groups.find((g) => g.type === "item");

    expect(orderGroup?.results[0].href).toBe("/comenzile-mele/order-1");
    expect(certGroup?.results[0].href).toBe("/comenzile-mele/order-1/certificat");
    expect(itemGroup?.results[0].href).toBe("/catalog");
  });
});

describe("globalSearch — alt rol (super_admin, fara organizatie)", () => {
  it("returneaza [] fara sa interogheze nimic", async () => {
    const result = await globalSearch("orice", { role: "super_admin" });
    expect(result).toEqual([]);
    expect(listOrders).not.toHaveBeenCalled();
    expect(listClients).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });
});
