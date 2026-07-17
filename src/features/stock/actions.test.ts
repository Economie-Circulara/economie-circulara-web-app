import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));

const { createLot, blockLot, unblockLot } = vi.hoisted(() => ({
  createLot: vi.fn(),
  blockLot: vi.fn(),
  unblockLot: vi.fn(),
}));
vi.mock("./service", () => ({ createLot, blockLot, unblockLot }));

const { redirect } = vi.hoisted(() => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));

import { blockLotAction, createLotAction, unblockLotAction } from "./actions";

afterEach(() => {
  vi.clearAllMocks();
});

function formData(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

describe("createLotAction", () => {
  it("respinge cererea cand itemul lipseste", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await createLotAction(
      { error: null, message: null },
      formData({ quantity: "10", provenance: "purchase" }),
    );
    expect(state.error).toMatch(/item/i);
    expect(createLot).not.toHaveBeenCalled();
  });

  it("respinge cantitatea invalida (<= 0)", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await createLotAction(
      { error: null, message: null },
      formData({ item_id: "item-1", quantity: "0", provenance: "purchase" }),
    );
    expect(state.error).toMatch(/cantitate/i);
    expect(createLot).not.toHaveBeenCalled();
  });

  it("respinge o proveniență necunoscuta", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await createLotAction(
      { error: null, message: null },
      formData({ item_id: "item-1", quantity: "10", provenance: "not-a-real-value" }),
    );
    expect(state.error).toMatch(/provenien/i);
    expect(createLot).not.toHaveBeenCalled();
  });

  it("creeaza lotul si redirectioneaza la /stoc cand datele sunt valide", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    createLot.mockResolvedValue({ id: "lot-1" });

    await expect(
      createLotAction(
        { error: null, message: null },
        formData({
          item_id: "item-1",
          quantity: "12,5",
          provenance: "recycling",
          source: "Santier X",
        }),
      ),
    ).rejects.toThrow("REDIRECT:/stoc");

    expect(createLot).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: "item-1",
        quantity: 12.5,
        provenance: "recycling",
        source: "Santier X",
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/stoc");
  });

  it("returneaza eroarea serviciului fara redirect (ex. item inexistent)", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    createLot.mockRejectedValue(new Error("Item inexistent sau fara acces."));

    const state = await createLotAction(
      { error: null, message: null },
      formData({ item_id: "item-x", quantity: "10", provenance: "purchase" }),
    );

    expect(state.error).toBe("Item inexistent sau fara acces.");
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("blockLotAction", () => {
  it("cere un motiv de blocare", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await blockLotAction({ error: null }, formData({ lot_id: "lot-1" }));
    expect(state.error).toMatch(/motiv/i);
    expect(blockLot).not.toHaveBeenCalled();
  });

  it("blocheaza lotul cu motivul dat", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    blockLot.mockResolvedValue({ id: "lot-1", isBlocked: true });

    const state = await blockLotAction(
      { error: null },
      formData({ lot_id: "lot-1", reason: "Contaminat" }),
    );

    expect(blockLot).toHaveBeenCalledWith("lot-1", "Contaminat");
    expect(state.error).toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/stoc");
  });

  it("propaga eroarea serviciului (ex. lot inexistent)", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    blockLot.mockRejectedValue(new Error("Lot inexistent sau fara acces."));

    const state = await blockLotAction(
      { error: null },
      formData({ lot_id: "lot-x", reason: "motiv" }),
    );

    expect(state.error).toBe("Lot inexistent sau fara acces.");
  });
});

describe("unblockLotAction", () => {
  it("deblocheaza lotul", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    unblockLot.mockResolvedValue({ id: "lot-1", isBlocked: false });

    const state = await unblockLotAction({ error: null }, formData({ lot_id: "lot-1" }));

    expect(unblockLot).toHaveBeenCalledWith("lot-1");
    expect(state.error).toBeNull();
  });

  it("cere un lot valid", async () => {
    requireRole.mockResolvedValue({ id: "u1" });
    const state = await unblockLotAction({ error: null }, formData({}));
    expect(state.error).toMatch(/lot/i);
    expect(unblockLot).not.toHaveBeenCalled();
  });
});
