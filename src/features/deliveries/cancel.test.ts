import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies - AGENTS.md §2.2) - anularea livrarilor (migrarea 0035).
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

// Dependinte grele ale service.ts, irelevante aici.
vi.mock("@react-pdf/renderer", () => ({ renderToBuffer: vi.fn() }));
vi.mock("./pdf", () => ({ AvizPdfDocument: vi.fn() }));
vi.mock("@/features/orders/notifications", () => ({ onOrderStatusChanged: vi.fn() }));

import { cancelDeliveryAction } from "./actions";
import { canCancelDelivery, hasDeliveryDeparted } from "./cancel";
import { DeliveryNotFoundError, DeliveryValidationError, cancelDelivery } from "./service";

afterEach(() => {
  vi.clearAllMocks();
});

function delivery(overrides: Record<string, unknown> = {}) {
  return {
    declarationStatus: "not_declared" as const,
    uitCode: null,
    receipt: {
      receivedAt: null,
      receivedByName: null,
      receiptNotes: null,
      receivedViaPortal: false,
    },
    ...overrides,
  };
}

describe("canCancelDelivery / hasDeliveryDeparted", () => {
  it("o livrare doar planificata (nedeclarata, fara receptie) se poate anula", () => {
    expect(canCancelDelivery(delivery())).toBe(true);
  });

  it("o declaratie e-Transport ESUATA (fara UIT) inca nu inseamna plecare", () => {
    expect(canCancelDelivery(delivery({ declarationStatus: "failed" }))).toBe(true);
  });

  it("declarata la e-Transport (UIT) = plecata", () => {
    expect(hasDeliveryDeparted(delivery({ declarationStatus: "declared", uitCode: "U1" }))).toBe(
      true,
    );
    expect(canCancelDelivery(delivery({ uitCode: "U1" }))).toBe(false);
  });

  it("receptie confirmata = plecata (si ajunsa)", () => {
    expect(
      canCancelDelivery(
        delivery({
          receipt: {
            receivedAt: "t",
            receivedByName: "Ion",
            receiptNotes: null,
            receivedViaPortal: false,
          },
        }),
      ),
    ).toBe(false);
  });
});

describe("cancelDelivery", () => {
  function mockRpc(error: { code?: string; message?: string } | null) {
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    createClient.mockResolvedValue({ rpc });
    return rpc;
  }

  it("apeleaza RPC-ul cancel_delivery cu motivul curatat", async () => {
    const rpc = mockRpc(null);
    await cancelDelivery("d1", " camion stricat ");
    expect(rpc).toHaveBeenCalledWith("cancel_delivery", {
      p_delivery_id: "d1",
      p_reason: "camion stricat",
    });
  });

  it("motiv gol => DeliveryValidationError, fara RPC", async () => {
    const rpc = mockRpc(null);
    await expect(cancelDelivery("d1", "")).rejects.toBeInstanceOf(DeliveryValidationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("DL001 (plecata) => mesaj clar", async () => {
    mockRpc({ code: "DL001", message: "raw" });
    await expect(cancelDelivery("d1", "x")).rejects.toThrow(/a plecat deja/);
  });

  it("DL002 => DeliveryNotFoundError", async () => {
    mockRpc({ code: "DL002", message: "raw" });
    await expect(cancelDelivery("d-x", "x")).rejects.toBeInstanceOf(DeliveryNotFoundError);
  });
});

describe("cancelDeliveryAction", () => {
  it("cere motiv", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const result = await cancelDeliveryAction("d1", "o1", "  ");
    expect(result.error).toMatch(/motivul/i);
  });

  it("la succes duce la comanda (care poate fi replanificata)", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    createClient.mockResolvedValue({ rpc: vi.fn().mockResolvedValue({ data: null, error: null }) });

    await expect(cancelDeliveryAction("d1", "o1", "motiv")).rejects.toThrow("REDIRECT:/comenzi/o1");
    expect(requireRole).toHaveBeenCalledWith(["admin", "operator"]);
    expect(revalidatePath).toHaveBeenCalledWith("/livrari");
  });
});
