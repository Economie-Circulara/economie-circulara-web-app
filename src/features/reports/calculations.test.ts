import { describe, expect, it } from "vitest";
import {
  aggregateOrdersByStatus,
  aggregateRecycledMaterials,
  computePaasUsage,
  computeSecondaryMaterialShare,
  filterAcceptedReturnLinksInRange,
  filterDeliveredOrdersInRange,
  filterReturnLinksRequestedInRange,
  formatItemsSummary,
  resolveDeliveryReferenceDate,
} from "./calculations";
import type { DeliveredOrderInput, ReturnLinkInput } from "./types";

describe("aggregateOrdersByStatus", () => {
  it("numara toate cele 6 statusuri, inclusiv cele absente (0)", () => {
    const result = aggregateOrdersByStatus([
      { status: "sent" },
      { status: "sent" },
      { status: "accepted" },
    ]);
    expect(result).toEqual([
      { status: "draft", label: "Draft", count: 0 },
      { status: "sent", label: "Trimisă", count: 2 },
      { status: "accepted", label: "Acceptată", count: 1 },
      { status: "delivered", label: "Livrată", count: 0 },
      { status: "closed", label: "Închisă", count: 0 },
      { status: "cancelled", label: "Anulată", count: 0 },
    ]);
  });

  it("intoarce toate 0 pentru o lista goala", () => {
    const result = aggregateOrdersByStatus([]);
    expect(result.every((row) => row.count === 0)).toBe(true);
  });
});

describe("resolveDeliveryReferenceDate", () => {
  it("foloseste delivered_at (momentul real al tranzitiei) cand exista", () => {
    expect(
      resolveDeliveryReferenceDate({
        deliveredAt: "2026-07-12T00:00:00Z",
        deliveryDate: "2026-07-10",
        updatedAt: "2026-07-15T00:00:00Z",
      }),
    ).toBe("2026-07-12T00:00:00Z");
  });

  it("cade pe delivery_date cand delivered_at lipseste (istoric fara timestamp)", () => {
    expect(
      resolveDeliveryReferenceDate({
        deliveredAt: null,
        deliveryDate: "2026-07-10",
        updatedAt: "2026-07-15T00:00:00Z",
      }),
    ).toBe("2026-07-10");
  });

  it("cade pe updated_at cand delivered_at si delivery_date lipsesc", () => {
    expect(
      resolveDeliveryReferenceDate({
        deliveredAt: null,
        deliveryDate: null,
        updatedAt: "2026-07-15T00:00:00Z",
      }),
    ).toBe("2026-07-15T00:00:00Z");
  });
});

function mockDeliveredOrder(overrides: Partial<DeliveredOrderInput> = {}): DeliveredOrderInput {
  return {
    id: "order-1",
    orderNumber: "CMD-2026-0001",
    status: "delivered",
    clientId: "client-1",
    clientName: "Construcții Apex SRL",
    deliveredAt: null,
    deliveryDate: null,
    updatedAt: "2026-07-10T00:00:00.000Z",
    items: [{ itemId: "item-1", itemTitle: "Cărămidă eco", unit: "buc", quantity: 4000 }],
    ...overrides,
  };
}

describe("filterDeliveredOrdersInRange", () => {
  const range = { from: "2026-07-01", to: "2026-07-18" };

  it("pastreaza comenzile a caror data de referinta cade in perioada", () => {
    const inRange = mockDeliveredOrder({ updatedAt: "2026-07-05T00:00:00.000Z" });
    const outOfRange = mockDeliveredOrder({ id: "order-2", updatedAt: "2026-06-01T00:00:00.000Z" });
    expect(filterDeliveredOrdersInRange([inRange, outOfRange], range)).toEqual([inRange]);
  });

  it("prioritizeaza delivered_at fata de delivery_date si updated_at", () => {
    // delivery_date si updated_at sunt in afara perioadei, dar delivered_at (momentul
    // real al tranzitiei) e in perioada.
    const order = mockDeliveredOrder({
      deliveredAt: "2026-07-16T00:00:00.000Z",
      deliveryDate: "2026-06-01",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(filterDeliveredOrdersInRange([order], range)).toEqual([order]);
  });

  it("prioritizeaza delivery_date fata de updated_at cand delivered_at lipseste (istoric)", () => {
    // updated_at e in afara perioadei, dar delivery_date (planificata) e in perioada.
    const order = mockDeliveredOrder({
      deliveryDate: "2026-07-15",
      updatedAt: "2026-08-01T00:00:00.000Z",
    });
    expect(filterDeliveredOrdersInRange([order], range)).toEqual([order]);
  });
});

describe("formatItemsSummary", () => {
  it("formateaza liniile ca text, separate prin virgula", () => {
    expect(
      formatItemsSummary([
        { itemTitle: "Cărămidă eco", quantity: 4000 },
        { itemTitle: "Pavaj", quantity: 600 },
      ]),
    ).toBe("Cărămidă eco ×4.000, Pavaj ×600");
  });

  it("intoarce em-dash pentru lista goala", () => {
    expect(formatItemsSummary([])).toBe("—");
  });
});

function mockReturnLink(overrides: Partial<ReturnLinkInput> = {}): ReturnLinkInput {
  return {
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
    ...overrides,
  };
}

describe("filterReturnLinksRequestedInRange", () => {
  it("filtreaza dupa data cererii (link_created_at), indiferent de statusul acceptarii", () => {
    const range = { from: "2026-07-01", to: "2026-07-18" };
    const requestedInRange = mockReturnLink({ returnOrderStatus: "draft" });
    const requestedBefore = mockReturnLink({
      linkId: "link-2",
      linkCreatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(filterReturnLinksRequestedInRange([requestedInRange, requestedBefore], range)).toEqual([
      requestedInRange,
    ]);
  });
});

describe("filterAcceptedReturnLinksInRange", () => {
  const range = { from: "2026-07-01", to: "2026-07-18" };

  it("pastreaza doar returnurile ACCEPTATE cu updated_at in perioada", () => {
    const accepted = mockReturnLink();
    const notAccepted = mockReturnLink({ linkId: "link-2", returnOrderStatus: "draft" });
    const acceptedButOutOfRange = mockReturnLink({
      linkId: "link-3",
      returnOrderUpdatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(
      filterAcceptedReturnLinksInRange([accepted, notAccepted, acceptedButOutOfRange], range),
    ).toEqual([accepted]);
  });
});

describe("aggregateRecycledMaterials", () => {
  it("agrega cantitatile pe (provenance, item) si numara loturile", () => {
    const rows = aggregateRecycledMaterials([
      {
        provenance: "recycling",
        itemId: "item-clay",
        itemTitle: "Argilă reciclată",
        unit: "kg",
        quantity: 500,
      },
      {
        provenance: "recycling",
        itemId: "item-clay",
        itemTitle: "Argilă reciclată",
        unit: "kg",
        quantity: 300,
      },
      {
        provenance: "reconditioning",
        itemId: "item-panel",
        itemTitle: "Panou beton",
        unit: "buc",
        quantity: 12,
      },
    ]);
    expect(rows).toEqual([
      {
        provenance: "recycling",
        provenanceLabel: "Reciclare",
        itemId: "item-clay",
        itemTitle: "Argilă reciclată",
        unit: "kg",
        quantity: 800,
        lotsCount: 2,
      },
      {
        provenance: "reconditioning",
        provenanceLabel: "Recondiționare",
        itemId: "item-panel",
        itemTitle: "Panou beton",
        unit: "buc",
        quantity: 12,
        lotsCount: 1,
      },
    ]);
  });
});

describe("computePaasUsage — utilizat = livrat - returnat", () => {
  it("calculeaza livrat/returnat/utilizat per (client, item)", () => {
    const delivered = [
      {
        clientId: "c1",
        clientName: "Apex",
        itemId: "i1",
        itemTitle: "Beton C20",
        unit: "mc",
        quantity: 100,
      },
      {
        clientId: "c1",
        clientName: "Apex",
        itemId: "i1",
        itemTitle: "Beton C20",
        unit: "mc",
        quantity: 20,
      },
    ];
    const returned = [
      {
        clientId: "c1",
        clientName: "Apex",
        itemId: "i1",
        itemTitle: "Beton C20",
        unit: "mc",
        quantity: 30,
      },
    ];
    expect(computePaasUsage(delivered, returned)).toEqual([
      {
        clientId: "c1",
        clientName: "Apex",
        itemId: "i1",
        itemTitle: "Beton C20",
        unit: "mc",
        delivered: 120,
        returned: 30,
        used: 90,
      },
    ]);
  });

  it("clamp la 0 daca returnat > livrat (nu raporteaza utilizare negativa)", () => {
    const delivered = [
      {
        clientId: "c1",
        clientName: "Apex",
        itemId: "i1",
        itemTitle: "Beton C20",
        unit: "mc",
        quantity: 10,
      },
    ];
    const returned = [
      {
        clientId: "c1",
        clientName: "Apex",
        itemId: "i1",
        itemTitle: "Beton C20",
        unit: "mc",
        quantity: 25,
      },
    ];
    const [row] = computePaasUsage(delivered, returned);
    expect(row.used).toBe(0);
  });

  it("include clientii cu doar retur (fara livrare in perioada) — delivered = 0", () => {
    const returned = [
      {
        clientId: "c2",
        clientName: "Verde Habitat",
        itemId: "i2",
        itemTitle: "Pavaj",
        unit: "mp",
        quantity: 15,
      },
    ];
    const [row] = computePaasUsage([], returned);
    expect(row).toMatchObject({ delivered: 0, returned: 15, used: 0 });
  });
});

describe("computeSecondaryMaterialShare — % materii prime secundare", () => {
  it("calculeaza procentul de input secundar (reciclare/recondiționare/retur) per produs", () => {
    const rows = computeSecondaryMaterialShare([
      { productItemId: "p1", productTitle: "Cărămidă eco", provenance: "recycling", quantity: 600 },
      { productItemId: "p1", productTitle: "Cărămidă eco", provenance: "purchase", quantity: 400 },
    ]);
    expect(rows).toEqual([
      {
        productItemId: "p1",
        productTitle: "Cărămidă eco",
        totalInput: 1000,
        secondaryInput: 600,
        percentageSecondary: 60,
      },
    ]);
  });

  it("trateaza reconditioning si return ca surse secundare", () => {
    const rows = computeSecondaryMaterialShare([
      { productItemId: "p1", productTitle: "Panou", provenance: "reconditioning", quantity: 50 },
      { productItemId: "p1", productTitle: "Panou", provenance: "return", quantity: 25 },
      {
        productItemId: "p1",
        productTitle: "Panou",
        provenance: "internal_production",
        quantity: 25,
      },
    ]);
    expect(rows[0].percentageSecondary).toBe(75);
  });

  it("intoarce 0% pentru total input 0 (fara diviziune cu 0)", () => {
    const rows = computeSecondaryMaterialShare([]);
    expect(rows).toEqual([]);
  });

  it("sorteaza descrescator dupa procent", () => {
    const rows = computeSecondaryMaterialShare([
      { productItemId: "low", productTitle: "Produs A", provenance: "purchase", quantity: 100 },
      { productItemId: "high", productTitle: "Produs B", provenance: "recycling", quantity: 100 },
    ]);
    expect(rows.map((r) => r.productItemId)).toEqual(["high", "low"]);
  });
});
