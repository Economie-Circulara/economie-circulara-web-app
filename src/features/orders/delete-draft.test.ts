import { afterEach, describe, expect, it, vi } from "vitest";

// Mocks (nu spies - AGENTS.md §2.2) - stergerea logica a ciornelor (migrarea 0035).
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
vi.mock("./notifications", () => ({ onOrderStatusChanged: vi.fn() }));

import { deleteDraftOrderAction } from "./actions";
import { OrderNotFoundError, OrderTransitionError, deleteDraftOrder } from "./service";

afterEach(() => {
  vi.clearAllMocks();
});

function mockRpc(error: { code?: string; message?: string } | null) {
  const rpc = vi.fn().mockResolvedValue({ data: null, error });
  createClient.mockResolvedValue({ rpc });
  return rpc;
}

describe("deleteDraftOrder", () => {
  it("apeleaza RPC-ul delete_draft_order (singura cale - RLS interzice UPDATE direct)", async () => {
    const rpc = mockRpc(null);

    await deleteDraftOrder("o1");

    expect(rpc).toHaveBeenCalledWith("delete_draft_order", { p_order_id: "o1" });
  });

  it("OD001 (comanda nu mai e ciorna) => OrderTransitionError cu indicatie spre Anulează", async () => {
    mockRpc({ code: "OD001", message: "not draft" });

    const promise = deleteDraftOrder("o1");
    await expect(promise).rejects.toBeInstanceOf(OrderTransitionError);
    await expect(deleteDraftOrder("o1")).rejects.toThrow(/Anulează/);
  });

  it("OR002 (inexistenta / alt tenant) => OrderNotFoundError", async () => {
    mockRpc({ code: "OR002", message: "not found" });
    await expect(deleteDraftOrder("o-x")).rejects.toBeInstanceOf(OrderNotFoundError);
  });
});

describe("deleteDraftOrderAction", () => {
  it("doar staff; la succes duce la lista de comenzi", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "operator" });
    mockRpc(null);

    await expect(deleteDraftOrderAction("o1")).rejects.toThrow("REDIRECT:/comenzi");
    expect(requireRole).toHaveBeenCalledWith(["admin", "operator"]);
    expect(revalidatePath).toHaveBeenCalledWith("/comenzi");
  });

  it("intoarce eroarea (fara redirect) cand comanda nu e ciorna", async () => {
    requireRole.mockResolvedValue({ id: "u1", role: "admin" });
    mockRpc({ code: "OD001", message: "not draft" });

    const result = await deleteDraftOrderAction("o1");

    expect(result.error).toMatch(/Ciornă/);
    expect(redirect).not.toHaveBeenCalled();
  });
});
