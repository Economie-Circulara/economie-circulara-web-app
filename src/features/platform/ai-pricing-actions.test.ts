import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole } = vi.hoisted(() => ({ requireRole: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireRole }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const insert = vi.fn();
const eq = vi.fn();
const update = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ insert, update }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ from })),
}));

const {
  addModelPriceAction,
  grantCreditsAction,
  updateCreditSettingsAction,
  updateOrganizationAiLimitsAction,
} = await import("./ai-pricing-actions");
const { initialModelPriceFormState, initialAiLimitsFormState } = await import("./form-state");

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

describe("updateCreditSettingsAction", () => {
  it("salveaza valoarea creditului in micro-USD si plafonul per mesaj", async () => {
    requireRole.mockResolvedValue({ id: "sa-1" });
    eq.mockResolvedValue({ error: null });

    const state = await updateCreditSettingsAction(
      initialAiLimitsFormState,
      form({ credit_usd: "0,001", turn_credit_limit: "150" }),
    );

    expect(state.error).toBeNull();
    expect(from).toHaveBeenCalledWith("ai_platform_settings");
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ credit_micros: 1000, turn_credit_limit: 150, updated_by: "sa-1" }),
    );
  });

  it("valori invalide nu ajung in DB", async () => {
    requireRole.mockResolvedValue({ id: "sa-1" });
    const state = await updateCreditSettingsAction(
      initialAiLimitsFormState,
      form({ credit_usd: "0", turn_credit_limit: "10" }),
    );
    expect(state.error).toMatch(/între 0 și 1/);
    expect(update).not.toHaveBeenCalled();
  });
});

describe("updateOrganizationAiLimitsAction", () => {
  it("doar super-adminul; salveaza bugetul, procentul si comutatorul", async () => {
    requireRole.mockResolvedValue({ id: "sa-1" });
    eq.mockResolvedValue({ error: null });

    await updateOrganizationAiLimitsAction(
      initialAiLimitsFormState,
      form({ organization_id: "org-1", monthly_credits: "5000", daily_percent: "25" }),
    );

    expect(requireRole).toHaveBeenCalledWith(["super_admin"]);
    expect(from).toHaveBeenCalledWith("organizations");
    expect(update).toHaveBeenCalledWith({
      ai_enabled: false,
      ai_monthly_credit_limit: 5000,
      ai_daily_user_credit_percent: 25,
    });
    expect(eq).toHaveBeenCalledWith("id", "org-1");
  });
});

describe("grantCreditsAction", () => {
  it("doar super-adminul; salveaza creditele, motivul si autorul", async () => {
    requireRole.mockResolvedValue({ id: "sa-1" });
    insert.mockResolvedValue({ error: null });

    const state = await grantCreditsAction(
      initialAiLimitsFormState,
      form({ organization_id: "org-1", credits: "500", reason: "cerere client, factura 12" }),
    );

    expect(requireRole).toHaveBeenCalledWith(["super_admin"]);
    expect(from).toHaveBeenCalledWith("ai_credit_grants");
    expect(insert).toHaveBeenCalledWith({
      organization_id: "org-1",
      credits: 500,
      reason: "cerere client, factura 12",
      created_by: "sa-1",
    });
    expect(state.message).toContain("500 credite");
  });

  it("fara motiv nu se acorda nimic", async () => {
    requireRole.mockResolvedValue({ id: "sa-1" });
    const state = await grantCreditsAction(
      initialAiLimitsFormState,
      form({ organization_id: "org-1", credits: "500", reason: "" }),
    );
    expect(state.error).toMatch(/obligatoriu/);
    expect(insert).not.toHaveBeenCalled();
  });
});
