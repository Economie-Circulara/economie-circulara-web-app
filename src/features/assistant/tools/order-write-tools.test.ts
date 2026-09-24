import { afterEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "../types";

vi.mock("@/features/orders/queries", () => ({
  getOrderDetail: vi.fn(),
  getOrderStatus: vi.fn(),
}));
vi.mock("@/features/orders/service", () => ({
  acceptOrder: vi.fn(),
  acceptIntakeOrder: vi.fn(),
  cancelOrder: vi.fn(),
  deleteDraftOrder: vi.fn(),
}));
vi.mock("@/features/orders/notifications", () => ({
  onOrderStatusChanged: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/features/deliveries/queries", () => ({ getDeliveryByOrderId: vi.fn() }));
vi.mock("@/features/deliveries/service", () => ({ cancelDelivery: vi.fn() }));

const { getOrderDetail, getOrderStatus } = await import("@/features/orders/queries");
const orderService = await import("@/features/orders/service");
const { onOrderStatusChanged } = await import("@/features/orders/notifications");
const { getDeliveryByOrderId } = await import("@/features/deliveries/queries");
const { cancelDelivery } = await import("@/features/deliveries/service");
const { acceptaComanda, anuleazaComanda, stergeCiorna, anuleazaLivrare } =
  await import("./order-write-tools");
const { InvalidToolArgumentsError } = await import("./types");

const CTX: ToolContext = { userId: "u1", role: "admin", organizationId: "org-1", clientId: null };

function order(overrides: Record<string, unknown> = {}) {
  return {
    id: "o1",
    clientId: "c1",
    orderNumber: "CMD-1",
    orderType: "material",
    status: "sent",
    clientName: "ACME SRL",
    items: [{ itemTitle: "Nisip", quantity: 5, unit: "tona" }],
    ...overrides,
  } as never;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("accepta_comanda", () => {
  it("vanzare: valideaza tranzitia, accepta (scade stocul) si trimite notificarea", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue(order());
    vi.mocked(orderService.acceptOrder).mockResolvedValue({
      id: "o1",
      clientId: "c1",
      status: "accepted",
    } as never);

    const result = await acceptaComanda.execute({ order_id: "o1" }, CTX);

    expect(orderService.acceptOrder).toHaveBeenCalledWith("o1");
    expect(orderService.acceptIntakeOrder).not.toHaveBeenCalled();
    expect(onOrderStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        fromStatus: "sent",
        toStatus: "accepted",
        organizationId: "org-1",
      }),
    );
    expect(result).toMatchObject({ status: "accepted", link: "/comenzi/o1" });
  });

  it("aport: RPC-ul dedicat, fara masina de stari de vanzare si fara notificare", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue(order({ orderType: "aport", status: "draft" }));
    vi.mocked(orderService.acceptIntakeOrder).mockResolvedValue({
      id: "o1",
      status: "accepted",
    } as never);

    await acceptaComanda.execute({ order_id: "o1" }, CTX);

    expect(orderService.acceptIntakeOrder).toHaveBeenCalledWith("o1");
    expect(orderService.acceptOrder).not.toHaveBeenCalled();
    expect(onOrderStatusChanged).not.toHaveBeenCalled();
  });

  it("o ciorna de vanzare nu se poate accepta direct (trebuie trimisa intai)", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue(order({ status: "draft" }));
    await expect(acceptaComanda.execute({ order_id: "o1" }, CTX)).rejects.toThrow();
    expect(orderService.acceptOrder).not.toHaveBeenCalled();
  });

  it("cardul spune ca stocul scade si arata liniile rezolvate, nu ID-ul", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue(order());
    const card = await acceptaComanda.presentation!({ order_id: "o1" }, CTX);
    expect(card.renderer).toBe("generic");
    const text = JSON.stringify(card);
    expect(text).toContain("CMD-1 · ACME SRL");
    expect(text).toContain("Nisip × 5 tona");
    expect(text).toContain("Stocul scade");
    expect(text).not.toContain('"displayValue":"o1"');
  });
});

describe("anuleaza_comanda", () => {
  it("anuleaza si notifica; comanda livrata e refuzata de masina de stari", async () => {
    vi.mocked(getOrderStatus).mockResolvedValueOnce("accepted");
    vi.mocked(orderService.cancelOrder).mockResolvedValue({
      id: "o1",
      clientId: "c1",
      status: "cancelled",
    } as never);
    await anuleazaComanda.execute({ order_id: "o1" }, CTX);
    expect(orderService.cancelOrder).toHaveBeenCalledWith("o1");
    expect(onOrderStatusChanged).toHaveBeenCalledWith(
      expect.objectContaining({ fromStatus: "accepted", toStatus: "cancelled" }),
    );

    vi.mocked(getOrderStatus).mockResolvedValueOnce("delivered");
    await expect(anuleazaComanda.execute({ order_id: "o1" }, CTX)).rejects.toThrow();
    expect(orderService.cancelOrder).toHaveBeenCalledTimes(1);
  });

  it("cardul avertizeaza ca stocul se reface doar la o comanda acceptata", async () => {
    vi.mocked(getOrderDetail).mockResolvedValue(order({ status: "accepted" }));
    expect(JSON.stringify(await anuleazaComanda.presentation!({ order_id: "o1" }, CTX))).toContain(
      "se reface",
    );
  });
});

describe("sterge_ciorna", () => {
  it("apeleaza stergerea logica", async () => {
    await stergeCiorna.execute({ order_id: "o1" }, CTX);
    expect(orderService.deleteDraftOrder).toHaveBeenCalledWith("o1");
  });
});

describe("anuleaza_livrare", () => {
  it("cere motivul", () => {
    expect(() => anuleazaLivrare.parse({ order_id: "o1" })).toThrow(InvalidToolArgumentsError);
  });

  it("anuleaza livrarea comenzii, cu motivul (editabil in card)", async () => {
    vi.mocked(getDeliveryByOrderId).mockResolvedValue({ id: "d1" } as never);
    await anuleazaLivrare.execute({ order_id: "o1", motiv: "camion defect" }, CTX);
    expect(cancelDelivery).toHaveBeenCalledWith("d1", "camion defect");
  });

  it("fara livrare planificata: eroare clara, nimic anulat", async () => {
    vi.mocked(getDeliveryByOrderId).mockResolvedValue(null);
    await expect(
      anuleazaLivrare.execute({ order_id: "o1", motiv: "x" }, CTX),
    ).rejects.toBeInstanceOf(InvalidToolArgumentsError);
    expect(cancelDelivery).not.toHaveBeenCalled();
  });
});
