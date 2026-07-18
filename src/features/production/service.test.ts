import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies — vezi AGENTS.md §2.2): inlocuim complet clientul Supabase server.
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { InsufficientStockError } from "@/features/stock/service";
import { ProcessNotFoundError, cancelProcess, confirmProcess } from "./service";

function processRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "proc-1",
    organization_id: "org-1",
    type: "output_fixed",
    status: "completed",
    output_item_id: "item-out",
    recipe_id: "recipe-1",
    notes: null,
    started_at: "2026-07-01T00:00:00.000Z",
    completed_at: "2026-07-01T00:05:00.000Z",
    created_by: "user-1",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:05:00.000Z",
    ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("confirmProcess", () => {
  it("apeleaza RPC confirm_process cu payload-ul mapat corect (snake_case)", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: processRow(), error: null });
    createClient.mockResolvedValue({ rpc });

    const result = await confirmProcess({
      type: "output_fixed",
      outputItemId: "item-out",
      recipeId: "recipe-1",
      notes: "test",
      inputs: [{ itemId: "item-a", lotIds: ["lot-1", "lot-2"], qty: 50 }],
      outputs: [{ itemId: "item-out", qty: 100, provenance: "internal_production" }],
    });

    expect(rpc).toHaveBeenCalledWith("confirm_process", {
      p_type: "output_fixed",
      p_output_item_id: "item-out",
      p_recipe_id: "recipe-1",
      p_notes: "test",
      p_inputs: [{ item_id: "item-a", lot_ids: ["lot-1", "lot-2"], qty: 50 }],
      p_outputs: [
        {
          item_id: "item-out",
          qty: 100,
          provenance: "internal_production",
          source: null,
          location: null,
          quality_status: null,
        },
      ],
    });
    expect(result.id).toBe("proc-1");
    expect(result.status).toBe("completed");
  });

  it("suporta provenienta 'reconditioning' (recondiționare) pe output — migrarea 0008", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: processRow(), error: null });
    createClient.mockResolvedValue({ rpc });

    await confirmProcess({
      type: "input_fixed",
      outputItemId: "item-out",
      inputs: [{ itemId: "item-a", lotIds: ["lot-1"], qty: 10 }],
      outputs: [{ itemId: "item-out", qty: 9, provenance: "reconditioning" }],
    });

    expect(rpc).toHaveBeenCalledWith(
      "confirm_process",
      expect.objectContaining({
        p_outputs: [expect.objectContaining({ provenance: "reconditioning" })],
      }),
    );
  });

  it("arunca InsufficientStockError cand RPC raporteaza codul LT001 (stoc insuficient)", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Stoc insuficient pentru itemul item-a", code: "LT001" },
    });
    createClient.mockResolvedValue({ rpc });

    await expect(
      confirmProcess({
        type: "output_fixed",
        outputItemId: "item-out",
        inputs: [{ itemId: "item-a", lotIds: ["lot-1"], qty: 1000 }],
        outputs: [{ itemId: "item-out", qty: 100, provenance: "internal_production" }],
      }),
    ).rejects.toBeInstanceOf(InsufficientStockError);
  });

  it("arunca eroare generica pentru alte coduri de eroare", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "eroare neasteptata", code: "XX" } });
    createClient.mockResolvedValue({ rpc });

    await expect(
      confirmProcess({
        type: "output_fixed",
        outputItemId: "item-out",
        inputs: [{ itemId: "item-a", lotIds: ["lot-1"], qty: 10 }],
        outputs: [{ itemId: "item-out", qty: 10, provenance: "internal_production" }],
      }),
    ).rejects.toThrow("eroare neasteptata");
  });
});

describe("cancelProcess", () => {
  it("apeleaza RPC cancel_process si returneaza procesul anulat", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: processRow({ status: "cancelled" }), error: null });
    createClient.mockResolvedValue({ rpc });

    const result = await cancelProcess("proc-1");

    expect(rpc).toHaveBeenCalledWith("cancel_process", { p_process_id: "proc-1" });
    expect(result.status).toBe("cancelled");
  });

  it("arunca ProcessNotFoundError cand RPC raporteaza codul LT002", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Proces inexistent, fara acces, sau deja finalizat/anulat", code: "LT002" },
    });
    createClient.mockResolvedValue({ rpc });

    await expect(cancelProcess("proc-x")).rejects.toBeInstanceOf(ProcessNotFoundError);
  });
});
