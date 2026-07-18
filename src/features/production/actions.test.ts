import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { listLots } = vi.hoisted(() => ({ listLots: vi.fn() }));
vi.mock("@/features/stock/queries", () => ({ listLots }));

const { getRecipeByItemId } = vi.hoisted(() => ({ getRecipeByItemId: vi.fn() }));
vi.mock("@/features/recipes/queries", () => ({ getRecipeByItemId }));

const { confirmProcess, cancelProcess } = vi.hoisted(() => ({
  confirmProcess: vi.fn(),
  cancelProcess: vi.fn(),
}));
vi.mock("./service", () => ({ confirmProcess, cancelProcess }));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { InsufficientStockError } from "@/features/stock/service";
import {
  cancelProcessAction,
  confirmProcessAction,
  getCandidateLots,
  getFifoPreview,
} from "./actions";

function lot(overrides: Record<string, unknown> = {}) {
  return {
    id: "lot-1",
    itemId: "item-1",
    itemTitle: "Moloz beton",
    unit: "kg",
    entryDate: "2026-06-01",
    source: null,
    provenance: "purchase",
    location: null,
    initialQty: 100,
    remainingQty: 100,
    qualityStatus: "unchecked",
    isBlocked: false,
    blockReason: null,
    createdAt: "2026-06-01T00:00:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("getCandidateLots", () => {
  it("exclude loturile blocate si cele fara stoc ramas", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    listLots.mockResolvedValue([
      lot({ id: "lot-ok", remainingQty: 20, isBlocked: false }),
      lot({ id: "lot-blocked", remainingQty: 50, isBlocked: true }),
      lot({ id: "lot-empty", remainingQty: 0, isBlocked: false }),
    ]);

    const result = await getCandidateLots("item-1");

    expect(result).toEqual([
      { lotId: "lot-ok", entryDate: "2026-06-01", remainingQty: 20, isBlocked: false },
    ]);
    expect(listLots).toHaveBeenCalledWith({ itemId: "item-1" });
  });
});

describe("getFifoPreview", () => {
  it("calculeaza alocarea FIFO pentru fiecare linie ceruta", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    listLots.mockResolvedValue([
      lot({ id: "lot-old", entryDate: "2026-01-01", remainingQty: 30 }),
      lot({ id: "lot-new", entryDate: "2026-02-01", remainingQty: 30 }),
    ]);

    const [result] = await getFifoPreview([{ itemId: "item-1", qty: 40 }]);

    expect(result.error).toBeNull();
    expect(result.allocation).toEqual([
      { lotId: "lot-old", qty: 30 },
      { lotId: "lot-new", qty: 10 },
    ]);
    expect(result.availableQty).toBe(60);
  });

  it("raporteaza eroare (fara sa arunce) cand stocul e insuficient — cazul 'stoc insuficient'", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    listLots.mockResolvedValue([lot({ id: "lot-1", remainingQty: 10 })]);

    const [result] = await getFifoPreview([{ itemId: "item-1", qty: 1000 }]);

    expect(result.allocation).toEqual([]);
    expect(result.error).toContain("Stoc insuficient");
    expect(result.availableQty).toBe(10);
  });
});

describe("confirmProcessAction", () => {
  it("redirectioneaza catre detaliul procesului la succes", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    confirmProcess.mockResolvedValue({ id: "proc-1" });

    await expect(
      confirmProcessAction({
        type: "output_fixed",
        outputItemId: "item-out",
        inputs: [{ itemId: "item-a", lotIds: ["lot-1"], qty: 10 }],
        outputs: [{ itemId: "item-out", qty: 10, provenance: "internal_production" }],
      }),
    ).rejects.toThrow("REDIRECT:/productie/proc-1");

    expect(revalidatePath).toHaveBeenCalledWith("/productie");
    expect(revalidatePath).toHaveBeenCalledWith("/stoc");
  });

  it("returneaza eroarea (stoc insuficient) fara redirect", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    confirmProcess.mockRejectedValue(new InsufficientStockError("item-a", 100, "Stoc insuficient"));

    const result = await confirmProcessAction({
      type: "output_fixed",
      outputItemId: "item-out",
      inputs: [{ itemId: "item-a", lotIds: ["lot-1"], qty: 100 }],
      outputs: [{ itemId: "item-out", qty: 100, provenance: "internal_production" }],
    });

    expect(result.error).toBe("Stoc insuficient");
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("cancelProcessAction", () => {
  it("anuleaza procesul si revalideaza paginile relevante", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    cancelProcess.mockResolvedValue({ id: "proc-1", status: "cancelled" });

    const result = await cancelProcessAction("proc-1");

    expect(result.error).toBeNull();
    expect(cancelProcess).toHaveBeenCalledWith("proc-1");
    expect(revalidatePath).toHaveBeenCalledWith("/productie");
    expect(revalidatePath).toHaveBeenCalledWith("/productie/proc-1");
  });

  it("returneaza eroarea cand procesul nu poate fi anulat (deja finalizat)", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    cancelProcess.mockRejectedValue(new Error("deja finalizat"));

    const result = await cancelProcessAction("proc-1");

    expect(result.error).toBe("deja finalizat");
  });
});
