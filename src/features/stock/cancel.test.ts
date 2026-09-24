import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies - AGENTS.md §2.2) - anularea loturilor (migrarea 0035).
const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { cancelLotAction } from "./actions";
import { canCancelLot } from "./cancel";
import { listLots } from "./queries";
import { LotNotFoundError, cancelLot } from "./service";
import type { LotTraceability } from "./types";

afterEach(() => {
  vi.clearAllMocks();
});

const NO_TRACE: LotTraceability = { producedBy: null, consumedBy: [] };

function lot(overrides: Record<string, unknown> = {}) {
  return {
    cancelledAt: null,
    remainingQty: 10,
    initialQty: 10,
    provenance: "purchase" as const,
    clientId: null,
    ...overrides,
  };
}

describe("canCancelLot (oglinda regulilor din RPC-ul cancel_lot)", () => {
  it("permis pentru un lot manual, neconsumat (doar intrare + blocare/deblocare)", () => {
    expect(canCancelLot(lot(), ["intake", "block", "unblock"], NO_TRACE)).toEqual({
      allowed: true,
      reason: null,
    });
  });

  it("refuzat daca lotul e deja anulat", () => {
    const result = canCancelLot(lot({ cancelledAt: "2026-09-01" }), ["intake"], NO_TRACE);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/deja anulat/);
  });

  it("refuzat daca s-a consumat ceva (cantitate ramasa < initiala)", () => {
    const result = canCancelLot(lot({ remainingQty: 4 }), ["intake"], NO_TRACE);
    expect(result).toEqual({ allowed: false, reason: expect.stringMatching(/consumat/) });
  });

  it("refuzat daca exista orice miscare de cantitate (ex. ajustare), chiar cu stocul refacut", () => {
    const result = canCancelLot(lot(), ["intake", "consumption", "reversal"], NO_TRACE);
    expect(result.allowed).toBe(false);
  });

  it("refuzat pentru loturi nascute dintr-un flux: proces, retur, aport", () => {
    const fromProcess: LotTraceability = {
      producedBy: {
        processId: "p1",
        type: "input_fixed",
        status: "completed",
        quantity: 10,
        createdAt: "t",
      },
      consumedBy: [],
    };
    expect(canCancelLot(lot(), ["intake"], fromProcess).allowed).toBe(false);
    expect(canCancelLot(lot({ provenance: "return" }), ["intake"], NO_TRACE).allowed).toBe(false);
    expect(
      canCancelLot(lot({ provenance: "aport_client", clientId: "c1" }), ["intake"], NO_TRACE)
        .allowed,
    ).toBe(false);
  });
});

describe("cancelLot (serviciu)", () => {
  function mockRpc(result: { data: unknown; error: unknown }) {
    const rpc = vi.fn().mockResolvedValue(result);
    createClient.mockResolvedValue({ rpc });
    return rpc;
  }

  it("apeleaza RPC-ul cancel_lot cu motivul curatat si mapeaza lotul anulat", async () => {
    const rpc = mockRpc({
      data: {
        id: "lot-1",
        lot_code: "LOT-2026-000001",
        item_id: "item-1",
        entry_date: "2026-07-01",
        source: null,
        provenance: "purchase",
        location: null,
        initial_qty: 10,
        remaining_qty: 0,
        quality_status: "unchecked",
        is_blocked: false,
        block_reason: null,
        client_id: null,
        cancelled_at: "2026-09-24T10:00:00.000Z",
        cancel_reason: "dublura",
        created_at: "t",
      },
      error: null,
    });

    const result = await cancelLot("lot-1", "  dublura  ");

    expect(rpc).toHaveBeenCalledWith("cancel_lot", { p_lot_id: "lot-1", p_reason: "dublura" });
    expect(result.remainingQty).toBe(0);
    expect(result.cancelledAt).toBe("2026-09-24T10:00:00.000Z");
    expect(result.cancelReason).toBe("dublura");
  });

  it("motiv gol => eroare, fara apel RPC", async () => {
    const rpc = mockRpc({ data: null, error: null });
    await expect(cancelLot("lot-1", "   ")).rejects.toThrow(/motivul/i);
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["LT008", /consumat/],
    ["LT009", /proces, un retur sau un aport/],
    ["LT007", /deja anulat/],
  ])("mapeaza codul %s la un mesaj clar", async (code, message) => {
    mockRpc({ data: null, error: { code, message: "raw" } });
    await expect(cancelLot("lot-1", "x")).rejects.toThrow(message);
  });

  it("LT002 => LotNotFoundError", async () => {
    mockRpc({ data: null, error: { code: "LT002", message: "nu exista" } });
    await expect(cancelLot("lot-x", "x")).rejects.toBeInstanceOf(LotNotFoundError);
  });
});

describe("cancelLotAction", () => {
  it("cere motiv (fara sa apeleze serviciul)", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const result = await cancelLotAction("lot-1", "");
    expect(result.error).toMatch(/motivul/i);
  });

  it("doar staff; revalideaza stocul si lotul", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    createClient.mockResolvedValue({
      rpc: vi.fn().mockResolvedValue({
        data: { id: "lot-1", initial_qty: 1, remaining_qty: 0 },
        error: null,
      }),
    });

    const result = await cancelLotAction("lot-1", "dublura");

    expect(result).toEqual({ error: null });
    expect(requireRole).toHaveBeenCalledWith(["admin", "operator"]);
    expect(revalidatePath).toHaveBeenCalledWith("/stoc/loturi/lot-1");
  });
});

describe("listLots - loturile anulate", () => {
  function makeBuilder() {
    const builder: Record<string, ReturnType<typeof vi.fn>> & {
      then: (resolve: (v: unknown) => void) => void;
    } = { then: (resolve: (v: unknown) => void) => resolve({ data: [], error: null }) } as never;
    for (const m of ["select", "order", "eq", "is"]) builder[m] = vi.fn(() => builder);
    return builder;
  }

  it("sunt ascunse implicit (stoc, preview FIFO, asistent)", async () => {
    const builder = makeBuilder();
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await listLots();

    expect(builder.is).toHaveBeenCalledWith("cancelled_at", null);
  });

  it("apar doar la cerere explicita", async () => {
    const builder = makeBuilder();
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await listLots({ includeCancelled: true });

    expect(builder.is).not.toHaveBeenCalled();
  });
});
