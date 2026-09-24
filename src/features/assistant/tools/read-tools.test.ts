import { describe, expect, it, vi } from "vitest";
import type { ToolContext } from "../types";

vi.mock("@/features/clients/queries", () => ({
  listClients: vi
    .fn()
    .mockResolvedValue([
      { id: "client-1", name: "ACME SRL", cui: "12345678", email: "contact@acme.ro" },
    ]),
}));

vi.mock("@/features/items/queries", () => ({
  listItems: vi.fn().mockResolvedValue([
    { id: "item-1", title: "Agregat 0-4", unit: "kg", kind: "physical" },
    { id: "item-2", title: "Mentenanță lunară", unit: "bucata", kind: "service" },
  ]),
}));

vi.mock("@/features/stock/queries", () => ({
  listLots: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/features/search/service", () => ({
  globalSearch: vi.fn().mockResolvedValue([
    {
      type: "clients",
      label: "Clienți",
      results: [{ id: "client-1", title: "ACME SRL", href: "/clienti/client-1" }],
    },
  ]),
}));

vi.mock("@/features/orders/queries", () => ({
  listIntakeItemOptions: vi
    .fn()
    .mockResolvedValue([
      { id: "item-moloz", title: "Moloz", unit: "tona", kind: "physical", isTracked: true },
    ]),
  getOrderDetail: vi.fn(),
}));

vi.mock("@/features/deliveries/queries", () => ({ getDeliveryByOrderId: vi.fn() }));
// Serviciul de livrari importa randarea PDF - aici avem nevoie doar de constanta de business.
vi.mock("@/features/deliveries/service", () => ({ PLANNABLE_ORDER_STATUS: "accepted" }));

vi.mock("@/features/routing/site-queries", () => ({
  listSites: vi.fn().mockResolvedValue([
    {
      id: "site-1",
      name: "Stația Otopeni",
      address: "DN1 km 12, Otopeni",
      isDefault: true,
    },
  ]),
}));

vi.mock("../docs-search", () => ({ searchManual: vi.fn() }));
vi.mock("@/features/clients/cui-lookup", () => ({
  defaultCuiLookupProvider: { lookup: vi.fn() },
  isValidCuiFormat: vi.fn().mockReturnValue(true),
  normalizeCui: vi.fn((cui: string) => cui),
}));

const { getOrderDetail } = await import("@/features/orders/queries");
const { getDeliveryByOrderId } = await import("@/features/deliveries/queries");
const { listeazaClienti, itemiVandabili, itemiAport, contextLivrare, cauta } =
  await import("./read-tools");

const CTX: ToolContext = {
  userId: "u1",
  role: "admin",
  organizationId: "org-1",
  clientId: null,
};

describe("listeaza_clienti", () => {
  it("include link-ul catre pagina clientului", async () => {
    const result = await listeazaClienti.execute({ cautare: null }, CTX);
    expect(result).toEqual([
      {
        client_id: "client-1",
        denumire: "ACME SRL",
        cui: "12345678",
        email: "contact@acme.ro",
        link: "/clienti/client-1",
      },
    ]);
  });
});

describe("itemi_vandabili", () => {
  it("include link-ul catre pagina itemului", async () => {
    const result = await itemiVandabili.execute({ cautare: null }, CTX);
    expect(result).toEqual([
      { item_id: "item-1", denumire: "Agregat 0-4", um: "kg", link: "/itemi/item-1" },
      {
        item_id: "item-2",
        denumire: "Mentenanță lunară",
        um: "bucata",
        link: "/abonamente/item-2",
      },
    ]);
  });
});

describe("itemi_aport", () => {
  it("foloseste catalogul de aport (itemi fizici, inclusiv nevandabili)", async () => {
    const result = await itemiAport.execute({ cautare: null }, CTX);
    expect(result).toEqual([
      { item_id: "item-moloz", denumire: "Moloz", um: "tona", link: "/itemi/item-moloz" },
    ]);
  });

  it("filtreaza dupa denumire", async () => {
    expect(await itemiAport.execute({ cautare: "beton" }, CTX)).toEqual([]);
    expect(await itemiAport.execute({ cautare: "mol" }, CTX)).toHaveLength(1);
  });
});

describe("context_livrare", () => {
  it("fara order_id intoarce doar punctele de plecare", async () => {
    const result = await contextLivrare.execute({ order_id: null }, CTX);
    expect(result).toEqual({
      puncte_plecare: [
        {
          punct_plecare_id: "site-1",
          denumire: "Stația Otopeni",
          adresa: "DN1 km 12, Otopeni",
          implicit: true,
        },
      ],
      comanda: null,
    });
  });

  it("marcheaza comanda acceptata fara livrare ca planificabila", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue({
      id: "o1",
      orderNumber: "CMD-1",
      clientName: "ACME SRL",
      status: "accepted",
      deliveryAddress: "Str. Livrării 10",
    } as never);
    vi.mocked(getDeliveryByOrderId).mockResolvedValue(null);

    const result = (await contextLivrare.execute({ order_id: "o1" }, CTX)) as {
      comanda: { poate_fi_planificata: boolean };
      livrare: unknown;
    };

    expect(result.comanda.poate_fi_planificata).toBe(true);
    expect(result.livrare).toBeNull();
  });

  it("o comanda cu livrare deja planificata nu mai e planificabila", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue({
      id: "o1",
      orderNumber: "CMD-1",
      clientName: "ACME SRL",
      status: "accepted",
      deliveryAddress: null,
    } as never);
    vi.mocked(getDeliveryByOrderId).mockResolvedValue({
      id: "d1",
      scheduledDate: "2026-10-01",
      carrierName: "Transport SRL",
    } as never);

    const result = (await contextLivrare.execute({ order_id: "o1" }, CTX)) as {
      comanda: { poate_fi_planificata: boolean };
      livrare: { link: string };
    };

    expect(result.comanda.poate_fi_planificata).toBe(false);
    expect(result.livrare.link).toBe("/livrari/d1");
  });

  it("o comanda in alt status decat acceptata nu e planificabila", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue({
      id: "o2",
      orderNumber: "CMD-2",
      clientName: "ACME SRL",
      status: "draft",
      deliveryAddress: null,
    } as never);
    vi.mocked(getDeliveryByOrderId).mockResolvedValue(null);

    const result = (await contextLivrare.execute({ order_id: "o2" }, CTX)) as {
      comanda: { poate_fi_planificata: boolean };
    };
    expect(result.comanda.poate_fi_planificata).toBe(false);
  });
});

describe("cauta", () => {
  it("remapeaza href in link si nu mai include href", async () => {
    const result = await cauta.execute({ text: "acme" }, CTX);
    expect(result).toEqual([
      {
        type: "clients",
        label: "Clienți",
        results: [{ id: "client-1", title: "ACME SRL", link: "/clienti/client-1" }],
      },
    ]);
  });
});
