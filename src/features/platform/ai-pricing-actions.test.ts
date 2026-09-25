import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const insert = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from: () => ({ insert }) })),
}));

const { addModelPriceAction } = await import("./ai-pricing-actions");
const { initialModelPriceFormState } = await import("./form-state");

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("addModelPriceAction", () => {
  it("doar super-adminul poate adauga preturi", async () => {
    requireRole.mockRejectedValue(new Error("REDIRECT"));
    await expect(addModelPriceAction(initialModelPriceFormState, form({}))).rejects.toThrow();
    expect(requireRole).toHaveBeenCalledWith(["super_admin"]);
    expect(insert).not.toHaveBeenCalled();
  });

  it("adauga o versiune noua, cu autorul si virgula zecimala acceptata", async () => {
    requireRole.mockResolvedValue({ id: "sa-1" });
    insert.mockResolvedValue({ error: null });

    const state = await addModelPriceAction(
      initialModelPriceFormState,
      form({
        model: "deepseek-v4-pro",
        input_cache_hit_per_m: "0,022",
        input_cache_miss_per_m: "0.66",
        output_per_m: "1.98",
        note: "listă oct. 2026",
      }),
    );

    expect(state).toEqual({
      error: null,
      message: "Prețul pentru „deepseek-v4-pro” a fost salvat.",
    });
    expect(insert).toHaveBeenCalledWith({
      model: "deepseek-v4-pro",
      input_cache_hit_per_m: 0.022,
      input_cache_miss_per_m: 0.66,
      output_per_m: 1.98,
      note: "listă oct. 2026",
      created_by: "sa-1",
    });
  });

  it("un pret invalid nu ajunge in DB", async () => {
    requireRole.mockResolvedValue({ id: "sa-1" });
    const state = await addModelPriceAction(
      initialModelPriceFormState,
      form({
        model: "x",
        input_cache_hit_per_m: "-1",
        input_cache_miss_per_m: "1",
        output_per_m: "1",
      }),
    );
    expect(state.error).toMatch(/input din cache/);
    expect(insert).not.toHaveBeenCalled();
  });
});
