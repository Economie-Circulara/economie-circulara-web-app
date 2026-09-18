import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies - vezi AGENTS.md §2.2).
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { getDeliveryByOrderId, getDeliveryDetail, mapDelivery } = vi.hoisted(() => ({
  getDeliveryByOrderId: vi.fn(),
  getDeliveryDetail: vi.fn(),
  // Alaturi de spread-ul brut (folosit de restul testelor), adauga aliasurile
  // camelCase `orderId`/`organizationId` pe care `confirmDeliveryReceipt` le
  // citeste acum (Task de legatura livrare<->status comanda) - mapDelivery
  // REAL (queries.ts) face aceeasi conversie completa, mock-ul o aproximeaza
  // doar pentru campurile de care service.ts are nevoie.
  mapDelivery: vi.fn((row: Record<string, unknown>) => ({
    mapped: true,
    ...row,
    orderId: row.order_id,
    organizationId: row.organization_id,
  })),
}));
vi.mock("./queries", () => ({
  getDeliveryByOrderId,
  getDeliveryDetail,
  mapDelivery,
  DELIVERY_CORE_COLUMNS: "id, organization_id, order_id",
}));

const { getETransportProvider } = vi.hoisted(() => ({ getETransportProvider: vi.fn() }));
vi.mock("./e-transport", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./e-transport")>();
  return { ...actual, getETransportProvider };
});

const { renderToBuffer } = vi.hoisted(() => ({ renderToBuffer: vi.fn() }));
vi.mock("@react-pdf/renderer", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@react-pdf/renderer")>();
  return { ...actual, renderToBuffer };
});

const { getSiteById } = vi.hoisted(() => ({ getSiteById: vi.fn() }));
vi.mock("@/features/routing/site-queries", () => ({ getSiteById }));

const { computeRouteBetween } = vi.hoisted(() => ({ computeRouteBetween: vi.fn() }));
vi.mock("@/features/routing/route-service", () => ({ computeRouteBetween }));

// Task de legatura livrare<->status comanda: `confirmDeliveryReceipt` apeleaza
// acum `getOrderStatus`/`setOrderStatus`/`onOrderStatusChanged` din features/orders
// (vezi comentariul din service.ts) - mock-uite separat, ca restul dependintelor.
const { getOrderStatus } = vi.hoisted(() => ({ getOrderStatus: vi.fn() }));
vi.mock("@/features/orders/queries", () => ({ getOrderStatus }));

const { setOrderStatus } = vi.hoisted(() => ({ setOrderStatus: vi.fn() }));
vi.mock("@/features/orders/service", () => ({ setOrderStatus }));

const { onOrderStatusChanged } = vi.hoisted(() => ({ onOrderStatusChanged: vi.fn() }));
vi.mock("@/features/orders/notifications", () => ({ onOrderStatusChanged }));

import { ETransportDeclarationError, ETransportNotConfiguredError } from "./e-transport";
import {
  DeliveryNotFoundError,
  DeliveryOrderNotFoundError,
  DeliveryValidationError,
  confirmDeliveryReceipt,
  declareETransport,
  planDelivery,
  recalculateDeliveryRoute,
  renderAvizPdfBuffer,
} from "./service";
import type { DeliveryDetail, PlanDeliveryInput } from "./types";

afterEach(() => {
  vi.clearAllMocks();
});

function validInput(overrides: Partial<PlanDeliveryInput> = {}): PlanDeliveryInput {
  return {
    orderId: "order-1",
    scheduledDate: "2026-08-01",
    carrierName: "Transport SRL",
    vehiclePlate: "B 123 ABC",
    driverName: "Ion Popescu",
    routeOrigin: "Depozit central",
    routeDestination: "Șantier Militari",
    ...overrides,
  };
}

/** Mock-uieste `createClient` pt. `planDelivery`: select comanda + insert livrare. */
function mockSupabaseForPlan(options: {
  order?: Record<string, unknown> | null;
  orderError?: { message: string } | null;
  insertedRow?: Record<string, unknown>;
  insertError?: { message: string } | null;
}) {
  const from = vi.fn((table: string) => {
    if (table === "orders") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: options.order ?? null,
              error: options.orderError ?? null,
            }),
          }),
        }),
      };
    }
    if (table === "deliveries") {
      return {
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: options.insertedRow ?? null,
              error: options.insertError ?? null,
            }),
          }),
        }),
      };
    }
    throw new Error(`Tabel neasteptat in test: ${table}`);
  });
  createClient.mockResolvedValue({ from });
  return from;
}

describe("planDelivery", () => {
  it("respinge un camp obligatoriu lipsa", async () => {
    await expect(planDelivery(validInput({ carrierName: "  " }))).rejects.toBeInstanceOf(
      DeliveryValidationError,
    );
  });

  it("respinge o data programata invalida", async () => {
    await expect(planDelivery(validInput({ scheduledDate: "nu-e-data" }))).rejects.toBeInstanceOf(
      DeliveryValidationError,
    );
  });

  it("arunca DeliveryOrderNotFoundError cand comanda nu exista (sau nu e accesibila prin RLS)", async () => {
    mockSupabaseForPlan({ order: null });

    await expect(planDelivery(validInput())).rejects.toBeInstanceOf(DeliveryOrderNotFoundError);
  });

  it("respinge o comanda care nu e in starea acceptata", async () => {
    mockSupabaseForPlan({
      order: { id: "order-1", organization_id: "org-1", status: "sent" },
    });

    await expect(planDelivery(validInput())).rejects.toBeInstanceOf(DeliveryValidationError);
  });

  it("respinge planificarea daca exista deja o livrare pt. aceasta comanda", async () => {
    mockSupabaseForPlan({
      order: { id: "order-1", organization_id: "org-1", status: "accepted" },
    });
    getDeliveryByOrderId.mockResolvedValue({ id: "delivery-existing" });

    await expect(planDelivery(validInput())).rejects.toBeInstanceOf(DeliveryValidationError);
  });

  it("planifica livrarea cu succes cand comanda e acceptata si fara livrare existenta", async () => {
    mockSupabaseForPlan({
      order: { id: "order-1", organization_id: "org-1", status: "accepted" },
      insertedRow: { id: "delivery-1", organization_id: "org-1", order_id: "order-1" },
    });
    getDeliveryByOrderId.mockResolvedValue(null);

    const result = await planDelivery(validInput());

    expect(mapDelivery).toHaveBeenCalledWith(
      expect.objectContaining({ id: "delivery-1", order_id: "order-1" }),
    );
    expect(result).toEqual(
      expect.objectContaining({ mapped: true, id: "delivery-1", order_id: "order-1" }),
    );
  });
});

function deliveryDetail(overrides: Partial<DeliveryDetail> = {}): DeliveryDetail {
  return {
    id: "delivery-1",
    organizationId: "org-1",
    orderId: "order-1",
    scheduledDate: "2026-08-01",
    carrierName: "Transport SRL",
    vehiclePlate: "B 123 ABC",
    driverName: "Ion Popescu",
    routeOrigin: "Depozit central",
    routeDestination: "Șantier Militari",
    uitCode: null,
    declarationStatus: "not_declared",
    declarationError: null,
    route: {
      originSiteId: null,
      distanceMeters: null,
      durationSeconds: null,
      polyline: null,
      alternatives: null,
      selectedIndex: null,
      selection: null,
      computedAt: null,
    },
    receipt: { receivedAt: null, receivedByName: null, receiptNotes: null },
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-01T00:00:00.000Z",
    orderNumber: "CMD-2026-0001",
    clientName: "Client SRL",
    clientCui: "RO123456",
    items: [{ itemId: "item-1", itemTitle: "Balast", unit: "tona", quantity: 12 }],
    ...overrides,
  };
}

/** Mock-uieste `createClient` pt. `declareETransport`: doar update-ul din `deliveries`. */
function mockSupabaseForUpdate(options: {
  updatedRow?: Record<string, unknown>;
  updateError?: { message: string } | null;
}) {
  const from = vi.fn(() => ({
    update: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: options.updatedRow ?? null,
            error: options.updateError ?? null,
          }),
        }),
      }),
    }),
  }));
  createClient.mockResolvedValue({ from });
  return from;
}

describe("declareETransport", () => {
  it("arunca DeliveryNotFoundError cand livrarea nu exista", async () => {
    getDeliveryDetail.mockResolvedValue(null);

    await expect(declareETransport("delivery-x")).rejects.toBeInstanceOf(DeliveryNotFoundError);
  });

  it("e idempotent: nu apeleaza providerul daca livrarea e deja declarata", async () => {
    const declared = deliveryDetail({ declarationStatus: "declared", uitCode: "UIT-123" });
    getDeliveryDetail.mockResolvedValue(declared);
    const declare = vi.fn();
    getETransportProvider.mockReturnValue({ declare });

    const result = await declareETransport("delivery-1");

    expect(declare).not.toHaveBeenCalled();
    expect(result).toEqual(declared);
  });

  it("declara cu succes: salveaza uit_code + declared, curata eroarea anterioara", async () => {
    getDeliveryDetail.mockResolvedValue(deliveryDetail({ declarationStatus: "not_declared" }));
    const declare = vi.fn().mockResolvedValue({ uit: "MOCK-UIT-ABC123" });
    getETransportProvider.mockReturnValue({ declare });
    const from = mockSupabaseForUpdate({
      updatedRow: { id: "delivery-1", uit_code: "MOCK-UIT-ABC123", declaration_status: "declared" },
    });

    const result = await declareETransport("delivery-1");

    const updateCall = from.mock.results[0]?.value.update as ReturnType<typeof vi.fn>;
    expect(updateCall).toHaveBeenCalledWith(
      expect.objectContaining({
        uit_code: "MOCK-UIT-ABC123",
        declaration_status: "declared",
        declaration_error: null,
      }),
    );
    expect(result).toEqual(expect.objectContaining({ mapped: true, uit_code: "MOCK-UIT-ABC123" }));
  });

  it("tratarea erorii de declarare: salveaza declaration_status=failed + mesajul erorii, fara sa arunce", async () => {
    getDeliveryDetail.mockResolvedValue(deliveryDetail({ declarationStatus: "not_declared" }));
    const declare = vi.fn().mockRejectedValue(new ETransportNotConfiguredError());
    getETransportProvider.mockReturnValue({ declare });
    const from = mockSupabaseForUpdate({
      updatedRow: {
        id: "delivery-1",
        declaration_status: "failed",
        declaration_error:
          "Integrarea Socrate.io nu este configurată (credențiale S4 în așteptare).",
      },
    });

    const result = await declareETransport("delivery-1");

    const updateCall = from.mock.results[0]?.value.update as ReturnType<typeof vi.fn>;
    expect(updateCall).toHaveBeenCalledWith(
      expect.objectContaining({
        declaration_status: "failed",
        declaration_error: expect.stringContaining("Socrate.io"),
      }),
    );
    expect(result).toEqual(expect.objectContaining({ mapped: true, declaration_status: "failed" }));
  });

  it("re-incercare: dupa un esec anterior (status failed), apeleaza din nou providerul", async () => {
    getDeliveryDetail.mockResolvedValue(
      deliveryDetail({ declarationStatus: "failed", declarationError: "eroare anterioară" }),
    );
    const declare = vi
      .fn()
      .mockRejectedValueOnce(new ETransportDeclarationError("indisponibil"))
      .mockResolvedValueOnce({ uit: "MOCK-UIT-RETRY" });
    getETransportProvider.mockReturnValue({ declare });
    mockSupabaseForUpdate({
      updatedRow: {
        id: "delivery-1",
        declaration_status: "failed",
        declaration_error: "indisponibil",
      },
    });

    const first = await declareETransport("delivery-1");
    expect(declare).toHaveBeenCalledTimes(1);
    expect(first).toEqual(expect.objectContaining({ declaration_status: "failed" }));

    mockSupabaseForUpdate({
      updatedRow: { id: "delivery-1", declaration_status: "declared", uit_code: "MOCK-UIT-RETRY" },
    });
    const second = await declareETransport("delivery-1");
    expect(declare).toHaveBeenCalledTimes(2);
    expect(second).toEqual(expect.objectContaining({ declaration_status: "declared" }));
  });
});

describe("renderAvizPdfBuffer", () => {
  it("randeaza avizul si intoarce un Buffer", async () => {
    renderToBuffer.mockResolvedValue(Buffer.from("pdf-content"));

    const buffer = await renderAvizPdfBuffer(deliveryDetail(), "Lateris Demo");

    expect(renderToBuffer).toHaveBeenCalledTimes(1);
    expect(buffer.toString()).toEqual("pdf-content");
  });
});

describe("recalculateDeliveryRoute", () => {
  it("arunca DeliveryNotFoundError cand livrarea nu exista", async () => {
    getDeliveryDetail.mockResolvedValue(null);

    await expect(recalculateDeliveryRoute("delivery-x")).rejects.toBeInstanceOf(
      DeliveryNotFoundError,
    );
  });

  it("respinge o livrare fara punct de plecare salvat (planificata fara calcul de ruta)", async () => {
    getDeliveryDetail.mockResolvedValue(
      deliveryDetail({ route: { ...deliveryDetail().route, originSiteId: null } }),
    );

    await expect(recalculateDeliveryRoute("delivery-1")).rejects.toBeInstanceOf(
      DeliveryValidationError,
    );
  });

  it("respinge daca punctul de plecare salvat nu mai exista", async () => {
    getDeliveryDetail.mockResolvedValue(
      deliveryDetail({ route: { ...deliveryDetail().route, originSiteId: "site-1" } }),
    );
    getSiteById.mockResolvedValue(null);

    await expect(recalculateDeliveryRoute("delivery-1")).rejects.toBeInstanceOf(
      DeliveryValidationError,
    );
  });

  it("recalculeaza, alege automat ruta cu durata minima si o salveaza (selection=auto)", async () => {
    getDeliveryDetail.mockResolvedValue(
      deliveryDetail({ route: { ...deliveryDetail().route, originSiteId: "site-1" } }),
    );
    getSiteById.mockResolvedValue({ id: "site-1", address: "Stație Iași" });
    computeRouteBetween.mockResolvedValue({
      routes: [
        { distanceMeters: 8000, durationSeconds: 900, polyline: "slow", label: "Ruta 1" },
        { distanceMeters: 6000, durationSeconds: 600, polyline: "fast", label: "Ruta 2" },
      ],
      origin: { lat: 1, lng: 2 },
      destination: { lat: 3, lng: 4 },
    });

    const single = vi.fn().mockResolvedValue({
      data: { id: "delivery-1", route_selection: "auto" },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    createClient.mockResolvedValue({ from });

    await recalculateDeliveryRoute("delivery-1");

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        route_distance_m: 6000,
        route_duration_s: 600,
        route_polyline: "fast",
        route_selected_index: 1,
        route_selection: "auto",
      }),
    );
  });
});

describe("confirmDeliveryReceipt", () => {
  /** Mock-uieste `createClient` pt. UPDATE-ul `deliveries` din `confirmDeliveryReceipt`. */
  function mockSupabaseForReceipt(row: Record<string, unknown>) {
    const single = vi.fn().mockResolvedValue({ data: row, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    createClient.mockResolvedValue({ from });
    return { update, eq };
  }

  it("respinge un nume gol al persoanei care confirma", async () => {
    await expect(
      confirmDeliveryReceipt({ deliveryId: "delivery-1", receivedByName: "   " }),
    ).rejects.toBeInstanceOf(DeliveryValidationError);
  });

  it("salveaza data curenta, numele si notele optionale", async () => {
    getOrderStatus.mockResolvedValue("accepted");
    setOrderStatus.mockResolvedValue({ id: "order-1", clientId: "client-1" });
    const { update, eq } = mockSupabaseForReceipt({
      id: "delivery-1",
      organization_id: "org-1",
      order_id: "order-1",
      received_at: "2026-09-14T00:00:00.000Z",
      received_by_name: "Ion Popescu",
      receipt_notes: "Fără observații",
    });

    await confirmDeliveryReceipt({
      deliveryId: "delivery-1",
      receivedByName: "Ion Popescu",
      notes: "Fără observații",
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        received_by_name: "Ion Popescu",
        receipt_notes: "Fără observații",
      }),
    );
    expect(eq).toHaveBeenCalledWith("id", "delivery-1");
  });

  it("dupa salvarea receptiei, tranzitioneaza automat comanda parinte pe delivered", async () => {
    getOrderStatus.mockResolvedValue("accepted");
    setOrderStatus.mockResolvedValue({ id: "order-1", clientId: "client-1" });
    mockSupabaseForReceipt({
      id: "delivery-1",
      organization_id: "org-1",
      order_id: "order-1",
      received_at: "2026-09-14T00:00:00.000Z",
      received_by_name: "Ion Popescu",
      receipt_notes: null,
    });

    await confirmDeliveryReceipt({ deliveryId: "delivery-1", receivedByName: "Ion Popescu" });

    expect(getOrderStatus).toHaveBeenCalledWith("order-1");
    expect(setOrderStatus).toHaveBeenCalledWith("order-1", "delivered");
    expect(onOrderStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: "order-1",
        organizationId: "org-1",
        clientId: "client-1",
        fromStatus: "accepted",
        toStatus: "delivered",
      }),
    );
  });

  it("nu incearca sa tranzitioneze comanda daca aceasta nu mai e accepted (deja delivered)", async () => {
    getOrderStatus.mockResolvedValue("delivered");
    mockSupabaseForReceipt({
      id: "delivery-1",
      organization_id: "org-1",
      order_id: "order-1",
      received_at: "2026-09-14T00:00:00.000Z",
      received_by_name: "Ion Popescu",
      receipt_notes: null,
    });

    await confirmDeliveryReceipt({ deliveryId: "delivery-1", receivedByName: "Ion Popescu" });

    expect(setOrderStatus).not.toHaveBeenCalled();
  });

  it("returneaza receptia salvata chiar daca actualizarea statusului comenzii esueaza", async () => {
    getOrderStatus.mockRejectedValue(new Error("boom"));
    mockSupabaseForReceipt({
      id: "delivery-1",
      organization_id: "org-1",
      order_id: "order-1",
      received_at: "2026-09-14T00:00:00.000Z",
      received_by_name: "Ion Popescu",
      receipt_notes: null,
    });

    const result = await confirmDeliveryReceipt({
      deliveryId: "delivery-1",
      receivedByName: "Ion Popescu",
    });

    expect(result).toEqual(
      expect.objectContaining({ id: "delivery-1", received_by_name: "Ion Popescu" }),
    );
  });
});
