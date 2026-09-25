import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "./types";

vi.mock("./db", () => ({ assistantDb: vi.fn() }));

const { assistantDb } = await import("./db");
const { DEFAULT_LIMITS, getQuotaStatus, monthStart, quotaMessage, recordUsage, recordUsageArgs } =
  await import("./quota");

const CTX: ToolContext = { userId: "u1", role: "admin", organizationId: "org-1", clientId: null };
const NOW = new Date("2026-09-13T08:00:00Z");

/**
 * Mock de client Supabase: `organizations` intoarce limitele, `assistant_usage`
 * randurile de consum. Suficient cat sa verificam aritmetica quota-ei, fara DB.
 */
function mockDb(options: {
  org?: { ai_enabled: boolean; monthly: number; daily: number } | null;
  usage?: { user_id: string; day: string; messages: number }[];
}) {
  const rpc = vi.fn().mockResolvedValue({ error: null });

  vi.mocked(assistantDb).mockResolvedValue({
    rpc,
    from: (table: string) => {
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: options.org
                  ? {
                      ai_enabled: options.org.ai_enabled,
                      ai_monthly_message_limit: options.org.monthly,
                      ai_daily_user_message_limit: options.org.daily,
                    }
                  : null,
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({ gte: async () => ({ data: options.usage ?? [] }) }),
        insert: async () => ({ error: null }),
      };
    },
  } as never);

  return { rpc };
}

beforeEach(() => vi.clearAllMocks());

describe("monthStart", () => {
  it("da prima zi a lunii curente", () => {
    expect(monthStart(NOW)).toBe("2026-09-01");
    expect(monthStart(new Date("2026-01-31T23:00:00Z"))).toBe("2026-01-01");
  });
});

describe("getQuotaStatus", () => {
  it("insumeaza consumul lunar al organizatiei si pe cel zilnic al utilizatorului", async () => {
    mockDb({
      org: { ai_enabled: true, monthly: 200, daily: 20 },
      usage: [
        { user_id: "u1", day: "2026-09-13", messages: 4 },
        { user_id: "u2", day: "2026-09-12", messages: 6 },
      ],
    });

    const quota = await getQuotaStatus(CTX, NOW);

    expect(quota.monthlyUsed).toBe(10);
    expect(quota.dailyUsed).toBe(4);
    expect(quota.blockedReason).toBeNull();
  });

  it("blocheaza pe limita lunara a organizatiei", async () => {
    mockDb({
      org: { ai_enabled: true, monthly: 10, daily: 20 },
      usage: [{ user_id: "u2", day: "2026-09-02", messages: 10 }],
    });

    const quota = await getQuotaStatus(CTX, NOW);

    expect(quota.blockedReason).toBe("monthly");
    expect(quotaMessage(quota)).toContain("10 mesaje incluse");
  });

  it("blocheaza pe plafonul zilnic al utilizatorului", async () => {
    mockDb({
      org: { ai_enabled: true, monthly: 200, daily: 3 },
      usage: [{ user_id: "u1", day: "2026-09-13", messages: 3 }],
    });

    const quota = await getQuotaStatus(CTX, NOW);

    expect(quota.blockedReason).toBe("daily");
    expect(quotaMessage(quota)).toContain("limita zilnică");
  });

  it("trateaza 0 ca nelimitat si respecta comutatorul organizatiei", async () => {
    mockDb({
      org: { ai_enabled: true, monthly: 0, daily: 0 },
      usage: [{ user_id: "u1", day: "2026-09-13", messages: 999 }],
    });
    expect((await getQuotaStatus(CTX, NOW)).blockedReason).toBeNull();

    mockDb({ org: { ai_enabled: false, monthly: 200, daily: 20 }, usage: [] });
    const disabled = await getQuotaStatus(CTX, NOW);
    expect(disabled.blockedReason).toBe("disabled");
    expect(quotaMessage(disabled)).toContain("dezactivat");
  });

  it("cade pe limitele implicite cand organizatia nu poate fi citita", async () => {
    mockDb({ org: null, usage: [] });

    const quota = await getQuotaStatus(CTX, NOW);

    expect(quota.monthlyLimit).toBe(DEFAULT_LIMITS.monthly);
    expect(quota.dailyLimit).toBe(DEFAULT_LIMITS.daily);
  });
});

describe("recordUsageArgs", () => {
  it("separa input-ul din cache de cel nou, ca in raspunsul DeepSeek", () => {
    expect(
      recordUsageArgs({
        feature: "assistant",
        model: "deepseek-v4-pro",
        conversationId: "c1",
        usage: {
          inputTokens: 10000,
          outputTokens: 540,
          cacheHitTokens: 7900,
          cacheMissTokens: 2100,
          reasoningTokens: 120,
        },
      }),
    ).toEqual({
      p_feature: "assistant",
      p_model: "deepseek-v4-pro",
      p_conversation_id: "c1",
      p_messages: 0,
      p_input_cache_hit: 7900,
      p_input_cache_miss: 2100,
      p_output_tokens: 540,
      p_reasoning_tokens: 120,
    });
  });

  it("fara detaliere de cache, tot input-ul e NOU (nu subestimam costul)", () => {
    const args = recordUsageArgs({
      feature: "recipe_extract",
      model: "x",
      usage: { inputTokens: 500, outputTokens: 10 },
    });
    expect(args.p_input_cache_hit).toBe(0);
    expect(args.p_input_cache_miss).toBe(500);
  });
});

describe("recordUsage", () => {
  it("un singur RPC atomic; costul il calculeaza DB-ul", async () => {
    const { rpc } = mockDb({ org: null, usage: [] });

    await recordUsage({
      feature: "assistant",
      model: "deepseek-flash",
      usage: { inputTokens: 120, outputTokens: 45 },
    });

    expect(rpc).toHaveBeenCalledWith(
      "assistant_record_usage",
      expect.objectContaining({ p_model: "deepseek-flash", p_input_cache_miss: 120 }),
    );
  });

  it("nimic de inregistrat (mock fara model, fara mesaj) -> niciun RPC", async () => {
    const { rpc } = mockDb({ org: null, usage: [] });
    await recordUsage({ feature: "assistant", usage: { inputTokens: 0, outputTokens: 0 } });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("o eroare de contorizare nu strica raspunsul (se jurnalizeaza)", async () => {
    const { rpc } = mockDb({ org: null, usage: [] });
    rpc.mockResolvedValue({ error: { message: "boom" } });
    const error = vi.fn();
    vi.stubGlobal("console", { ...console, error });

    await expect(recordUsage({ feature: "assistant", messages: 1 })).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
