import { afterEach, describe, expect, it, vi } from "vitest";

const repository = vi.hoisted(() => ({
  fetchOrderStatusesCreatedInRange: vi.fn(),
  fetchDeliveredOrdersWithItems: vi.fn(),
  fetchReturnLinks: vi.fn(),
  fetchRecycledLotsInRange: vi.fn(),
  fetchProcessInputsCompletedInRange: vi.fn(),
}));
vi.mock("./repository", () => repository);

import {
  getDeliveriesReport,
  getOrdersByStatusReport,
  getPaasUsageReport,
  getRecycledMaterialsReport,
  getReturnsReport,
  getSecondaryMaterialReport,
} from "./queries";

const RANGE = { from: "2026-07-01", to: "2026-07-18" };

afterEach(() => {
  vi.clearAllMocks();
});

describe("getOrdersByStatusReport", () => {
  it("agrega comenzile fetch-uite pe status", async () => {
    repository.fetchOrderStatusesCreatedInRange.mockResolvedValue([
      { status: "sent" },
      { status: "sent" },
    ]);

    const result = await getOrdersByStatusReport(RANGE);

    expect(repository.fetchOrderStatusesCreatedInRange).toHaveBeenCalledWith(RANGE);
    expect(result.find((row) => row.status === "sent")).toMatchObject({ count: 2 });
  });
});

describe("getDeliveriesReport", () => {
  it("filtreaza pe perioada si formateaza randurile pentru afisare", async () => {
    repository.fetchDeliveredOrdersWithItems.mockResolvedValue([
      {
        id: "order-1",
        orderNumber: "CMD-2026-0001",
        status: "delivered",
        clientId: "client-1",
        clientName: "Construcții Apex SRL",
        deliveryDate: "2026-07-10",
        updatedAt: "2026-07-10T00:00:00.000Z",
        items: [{ itemId: "item-1", itemTitle: "Cărămidă eco", unit: "buc", quantity: 4000 }],
      },
      {
        id: "order-2",
        orderNumber: "CMD-2026-0002",
        status: "closed",
        clientId: "client-2",
        clientName: "Verde Habitat SA",
        deliveryDate: "2026-06-01", // in afara perioadei
        updatedAt: "2026-06-01T00:00:00.000Z",
        items: [],
      },
    ]);

    const result = await getDeliveriesReport(RANGE);

    expect(result).toEqual([
      {
        orderId: "order-1",
        orderNumber: "CMD-2026-0001",
        status: "delivered",
        clientName: "Construcții Apex SRL",
        referenceDate: "2026-07-10",
        itemsSummary: "Cărămidă eco ×4.000",
      },
    ]);
  });
});

describe("getReturnsReport", () => {
  it("filtreaza legaturile pe data cererii (link_created_at)", async () => {
    repository.fetchReturnLinks.mockResolvedValue([
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

    const result = await getReturnsReport(RANGE);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      originalOrderNumber: "CMD-2026-0001",
      itemsSummary: "Cărămidă eco ×200",
    });
  });
});

describe("getRecycledMaterialsReport", () => {
  it("agrega loturile fetch-uite deja filtrate de repository", async () => {
    repository.fetchRecycledLotsInRange.mockResolvedValue([
      {
        provenance: "recycling",
        itemId: "item-clay",
        itemTitle: "Argilă",
        unit: "kg",
        quantity: 500,
      },
    ]);

    const result = await getRecycledMaterialsReport(RANGE);
    expect(repository.fetchRecycledLotsInRange).toHaveBeenCalledWith(RANGE);
    expect(result).toEqual([
      expect.objectContaining({ itemTitle: "Argilă", quantity: 500, lotsCount: 1 }),
    ]);
  });
});

describe("getPaasUsageReport", () => {
  it("combina livrat (in perioada) si returnat (accepted, in perioada)", async () => {
    repository.fetchDeliveredOrdersWithItems.mockResolvedValue([
      {
        id: "order-1",
        orderNumber: "CMD-1",
        status: "delivered",
        clientId: "client-1",
        clientName: "Apex",
        deliveryDate: "2026-07-05",
        updatedAt: "2026-07-05T00:00:00.000Z",
        items: [{ itemId: "item-1", itemTitle: "Beton C20", unit: "mc", quantity: 100 }],
      },
    ]);
    repository.fetchReturnLinks.mockResolvedValue([
      {
        linkId: "link-1",
        linkType: "return",
        linkCreatedAt: "2026-07-06T00:00:00.000Z",
        originalOrderId: "order-1",
        originalOrderNumber: "CMD-1",
        clientId: "client-1",
        clientName: "Apex",
        returnOrderId: "order-return-1",
        returnOrderNumber: "CMD-2",
        returnOrderStatus: "accepted",
        returnOrderUpdatedAt: "2026-07-08T00:00:00.000Z",
        items: [{ itemId: "item-1", itemTitle: "Beton C20", unit: "mc", quantity: 30 }],
      },
    ]);

    const result = await getPaasUsageReport(RANGE);
    expect(result).toEqual([
      {
        clientId: "client-1",
        clientName: "Apex",
        itemId: "item-1",
        itemTitle: "Beton C20",
        unit: "mc",
        delivered: 100,
        returned: 30,
        used: 70,
      },
    ]);
  });
});

describe("getSecondaryMaterialReport", () => {
  it("calculeaza % materii secundare din inputurile de proces fetch-uite", async () => {
    repository.fetchProcessInputsCompletedInRange.mockResolvedValue([
      { productItemId: "p1", productTitle: "Cărămidă eco", provenance: "recycling", quantity: 60 },
      { productItemId: "p1", productTitle: "Cărămidă eco", provenance: "purchase", quantity: 40 },
    ]);

    const result = await getSecondaryMaterialReport(RANGE);
    expect(result).toEqual([
      {
        productItemId: "p1",
        productTitle: "Cărămidă eco",
        totalInput: 100,
        secondaryInput: 60,
        percentageSecondary: 60,
      },
    ]);
  });
});
