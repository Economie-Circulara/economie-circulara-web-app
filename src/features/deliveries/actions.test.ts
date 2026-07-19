import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { planDelivery, declareETransport } = vi.hoisted(() => ({
  planDelivery: vi.fn(),
  declareETransport: vi.fn(),
}));
vi.mock("./service", () => ({
  planDelivery,
  declareETransport,
  DeliveryValidationError: class DeliveryValidationError extends Error {},
  DeliveryOrderNotFoundError: class DeliveryOrderNotFoundError extends Error {},
  DeliveryNotFoundError: class DeliveryNotFoundError extends Error {},
}));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { declareETransportAction, planDeliveryAction } from "./actions";
import { initialDeliveryFormState } from "./action-state";

afterEach(() => {
  vi.clearAllMocks();
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("planDeliveryAction — gating rol", () => {
  it("cere rolul admin/operator (NU permite client)", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "admin" });
    planDelivery.mockResolvedValue({ id: "delivery-1" });

    await expect(
      planDeliveryAction(
        initialDeliveryFormState,
        formData({
          order_id: "order-1",
          scheduled_date: "2026-08-01",
          carrier_name: "Transport SRL",
          vehicle_plate: "B 123 ABC",
          driver_name: "Ion Popescu",
          route_origin: "Depozit",
          route_destination: "Șantier",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/livrari/delivery-1");

    expect(requireRole).toHaveBeenCalledWith(["admin", "operator"]);
  });
});

describe("planDeliveryAction", () => {
  it("respinge cererea fara order_id, fara sa apeleze serviciul", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "admin" });

    const result = await planDeliveryAction(initialDeliveryFormState, formData({}));

    expect(planDelivery).not.toHaveBeenCalled();
    expect(result.error).toBeTruthy();
  });

  it("planifica livrarea si redirectioneaza catre /livrari/:id la succes", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "operator" });
    planDelivery.mockResolvedValue({ id: "delivery-42" });

    await expect(
      planDeliveryAction(
        initialDeliveryFormState,
        formData({
          order_id: "order-1",
          scheduled_date: "2026-08-01",
          carrier_name: "Transport SRL",
          vehicle_plate: "B 123 ABC",
          driver_name: "Ion Popescu",
          route_origin: "Depozit",
          route_destination: "Șantier",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/livrari/delivery-42");

    expect(revalidatePath).toHaveBeenCalledWith("/livrari");
    expect(revalidatePath).toHaveBeenCalledWith("/comenzi/order-1");
  });

  it("returneaza eroarea serviciului fara redirect", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "admin" });
    const { DeliveryValidationError } = await import("./service");
    planDelivery.mockRejectedValue(
      new DeliveryValidationError("Comanda are deja o livrare planificată."),
    );

    const result = await planDeliveryAction(
      initialDeliveryFormState,
      formData({
        order_id: "order-1",
        scheduled_date: "2026-08-01",
        carrier_name: "Transport SRL",
        vehicle_plate: "B 123 ABC",
        driver_name: "Ion Popescu",
        route_origin: "Depozit",
        route_destination: "Șantier",
      }),
    );

    expect(redirect).not.toHaveBeenCalled();
    expect(result.error).toEqual("Comanda are deja o livrare planificată.");
  });
});

describe("declareETransportAction — gating rol", () => {
  it("cere rolul admin/operator", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "admin" });
    declareETransport.mockResolvedValue({ id: "delivery-1", declarationStatus: "declared" });

    await declareETransportAction("delivery-1");

    expect(requireRole).toHaveBeenCalledWith(["admin", "operator"]);
  });
});

describe("declareETransportAction", () => {
  it("intoarce livrarea actualizata la succes", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "admin" });
    const delivery = { id: "delivery-1", declarationStatus: "declared", uitCode: "MOCK-UIT-ABC" };
    declareETransport.mockResolvedValue(delivery);

    const result = await declareETransportAction("delivery-1");

    expect(result).toEqual({ delivery, error: null });
    expect(revalidatePath).toHaveBeenCalledWith("/livrari/delivery-1");
  });

  it("intoarce eroarea (re-incercabila) fara sa arunce, cand declararea esueaza", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "operator" });
    declareETransport.mockRejectedValue(new Error("Socrate.io indisponibil"));

    const result = await declareETransportAction("delivery-1");

    expect(result).toEqual({ delivery: null, error: "Socrate.io indisponibil" });
  });
});
