import { afterEach, describe, expect, it, vi } from "vitest";

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient }));

import { createItem, updateItem } from "./service";

function itemRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    organization_id: "org-1",
    title: "Cărămidă eco",
    description: null,
    unit: "bucata",
    kind: "physical",
    sellable: true,
    image_url: null,
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Builder chainable pentru insert/update: `.single()` e terminal si rezolva. */
function makeMutationBuilder(finalResult: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {};
  builder.insert = vi.fn(() => builder);
  builder.update = vi.fn(() => builder);
  builder.eq = vi.fn(() => builder);
  builder.select = vi.fn(() => builder);
  builder.single = vi.fn().mockResolvedValue(finalResult);
  return builder as Record<string, ReturnType<typeof vi.fn>>;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("createItem", () => {
  it("insereaza itemul cu organization_id si mapeaza randul intors", async () => {
    const builder = makeMutationBuilder({ data: itemRow(), error: null });
    const from = vi.fn().mockReturnValue(builder);
    createClient.mockResolvedValue({ from });

    const result = await createItem({
      organizationId: "org-1",
      title: "Cărămidă eco",
      unit: "bucata",
      kind: "physical",
      sellable: true,
    });

    expect(from).toHaveBeenCalledWith("items");
    expect(builder.insert).toHaveBeenCalledWith({
      organization_id: "org-1",
      title: "Cărămidă eco",
      description: null,
      unit: "bucata",
      kind: "physical",
      sellable: true,
      image_url: null,
    });
    expect(result).toEqual({
      id: "item-1",
      title: "Cărămidă eco",
      description: null,
      unit: "bucata",
      kind: "physical",
      sellable: true,
      imageUrl: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      updatedAt: "2026-07-01T00:00:00.000Z",
    });
  });

  it("arunca eroare cand insertul esueaza", async () => {
    const builder = makeMutationBuilder({ data: null, error: { message: "boom" } });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await expect(
      createItem({
        organizationId: "org-1",
        title: "X",
        unit: "kg",
        kind: "physical",
        sellable: false,
      }),
    ).rejects.toThrow("boom");
  });
});

describe("updateItem", () => {
  it("actualizeaza itemul dupa id", async () => {
    const builder = makeMutationBuilder({ data: itemRow({ title: "Nou" }), error: null });
    const from = vi.fn().mockReturnValue(builder);
    createClient.mockResolvedValue({ from });

    const result = await updateItem("item-1", {
      title: "Nou",
      unit: "bucata",
      kind: "service",
      sellable: true,
      imageUrl: "https://example.com/img.png",
    });

    expect(builder.eq).toHaveBeenCalledWith("id", "item-1");
    expect(builder.update).toHaveBeenCalledWith({
      title: "Nou",
      description: null,
      unit: "bucata",
      kind: "service",
      sellable: true,
      image_url: "https://example.com/img.png",
    });
    expect(result.title).toBe("Nou");
  });

  it("arunca eroare cand itemul nu exista sau nu e accesibil (izolare tenant)", async () => {
    const builder = makeMutationBuilder({ data: null, error: null });
    createClient.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });

    await expect(
      updateItem("item-x", { title: "X", unit: "kg", kind: "physical", sellable: false }),
    ).rejects.toThrow();
  });
});
