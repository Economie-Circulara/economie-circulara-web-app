import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "./types";

vi.mock("./db", () => ({ assistantDb: vi.fn() }));

const { assistantDb } = await import("./db");
const {
  creditsFromMicros,
  DEFAULT_LIMITS,
  getQuotaStatus,
  monthStart,
  quotaMessage,
  recordUsage,
  recordUsageArgs,
} = await import("./quota");

const CTX: ToolContext = { userId: "u1", role: "admin", organizationId: "org-1", clientId: null };
const NOW = new Date("2026-09-13T08:00:00Z");

/**
 * Mock de client Supabase: `organizations` intoarce limitele, `ai_platform_settings`
 * valoarea creditului, `assistant_usage` randurile de consum.
 */
function mockDb(options: {
  org?: { ai_enabled: boolean; monthly: number; dailyPercent: number } | null;
  usage?: { user_id: string; day: string; messages: number; cost_micros: number }[];
  creditMicros?: number;
  grants?: number[];
}) {
  const rpc = vi.fn().mockResolvedValue({ data: 0, error: null });

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
                      ai_monthly_credit_limit: options.org.monthly,
                      ai_daily_user_credit_percent: options.org.dailyPercent,
                    }
                  : null,
              }),
            }),
          }),
        };
      }
      if (table === "ai_credit_grants") {
        return {
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: (options.grants ?? []).map((credits) => ({ credits })) }),
            }),
          }),
        };
      }
      if (table === "ai_platform_settings") {
        return {
          select: () => ({
            maybeSingle: async () => ({
              data: { credit_micros: options.creditMicros ?? 1000, turn_credit_limit: 100 },
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

describe("creditsFromMicros", () => {
  it("rotunjeste in sus; zero ramane zero", () => {
    expect(creditsFromMicros(2600, 1000)).toBe(3);
    expect(creditsFromMicros(1, 1000)).toBe(1);
    expect(creditsFromMicros(0, 1000)).toBe(0);
  });
});

describe("getQuotaStatus (credite)", () => {
  it("transforma costul real in credite: lunar pe organizatie, zilnic pe utilizator", async () => {
    mockDb({
      org: { ai_enabled: true, monthly: 2000, dailyPercent: 20 },
      usage: [
        // $0.0807 azi (utilizatorul curent) + $0.0245 ieri (alt utilizator)
        { user_id: "u1", day: "2026-09-13", messages: 8, cost_micros: 80666 },
        { user_id: "u2", day: "2026-09-12", messages: 4, cost_micros: 24544 },
      ],
    });

    const quota = await getQuotaStatus(CTX, NOW);

    expect(quota.monthlyUsed).toBe(106); // ceil(105210 / 1000)
    expect(quota.dailyUsed).toBe(81);
    expect(quota.dailyLimit).toBe(400); // 20% din 2000
    expect(quota.messagesThisMonth).toBe(12);
    // ~8.8 credite / mesaj -> (2000 - 106) / 8.83 ≈ 214 intrebari
    expect(quota.estimatedMessagesLeft).toBe(214);
    expect(quota.warning).toBe(false);
    expect(quota.blockedReason).toBeNull();
  });

  it("creditele extra (top-up) ale lunii se adauga peste buget", async () => {
    mockDb({
      org: { ai_enabled: true, monthly: 100, dailyPercent: 0 },
      usage: [{ user_id: "u2", day: "2026-09-02", messages: 10, cost_micros: 100000 }],
      grants: [300, 200],
    });

    const quota = await getQuotaStatus(CTX, NOW);

    expect(quota.monthlyBase).toBe(100);
    expect(quota.monthlyBonus).toBe(500);
    expect(quota.monthlyLimit).toBe(600);
    expect(quota.blockedReason).toBeNull();
  });

  it("o organizatie nelimitata ramane nelimitata (top-up-ul nu o limiteaza)", async () => {
    mockDb({ org: { ai_enabled: true, monthly: 0, dailyPercent: 0 }, usage: [], grants: [500] });
    const quota = await getQuotaStatus(CTX, NOW);
    expect(quota.monthlyLimit).toBe(0);
    expect(quota.monthlyBonus).toBe(0);
  });

  it("valoarea creditului vine din setarile platformei", async () => {
    mockDb({
      org: { ai_enabled: true, monthly: 2000, dailyPercent: 20 },
      usage: [{ user_id: "u1", day: "2026-09-13", messages: 1, cost_micros: 80666 }],
      creditMicros: 10000,
    });
    expect((await getQuotaStatus(CTX, NOW)).monthlyUsed).toBe(9);
  });

  it("avertizeaza de la 80% si blocheaza la 100% (limita lunara a organizatiei)", async () => {
    mockDb({
      org: { ai_enabled: true, monthly: 100, dailyPercent: 0 },
      usage: [{ user_id: "u2", day: "2026-09-02", messages: 10, cost_micros: 85000 }],
    });
    const warning = await getQuotaStatus(CTX, NOW);
    expect(warning.warning).toBe(true);
    expect(warning.blockedReason).toBeNull();

    mockDb({
      org: { ai_enabled: true, monthly: 100, dailyPercent: 0 },
      usage: [{ user_id: "u2", day: "2026-09-02", messages: 10, cost_micros: 100000 }],
    });
    const blocked = await getQuotaStatus(CTX, NOW);
    expect(blocked.blockedReason).toBe("monthly");
    expect(quotaMessage(blocked)).toContain("100 credite AI incluse");
  });

  it("blocheaza pe plafonul zilnic al utilizatorului (procent din bugetul lunar)", async () => {
    mockDb({
      org: { ai_enabled: true, monthly: 2000, dailyPercent: 10 },
      usage: [{ user_id: "u1", day: "2026-09-13", messages: 30, cost_micros: 200000 }],
    });

    const quota = await getQuotaStatus(CTX, NOW);

    expect(quota.dailyLimit).toBe(200);
    expect(quota.blockedReason).toBe("daily");
    expect(quotaMessage(quota)).toContain("10% din bugetul lunar");
  });

  it("nu estimeaza „intrebari ramase” pana nu exista cateva mesaje", async () => {
    mockDb({
      org: { ai_enabled: true, monthly: 2000, dailyPercent: 20 },
      usage: [{ user_id: "u1", day: "2026-09-13", messages: 2, cost_micros: 5000 }],
    });
    expect((await getQuotaStatus(CTX, NOW)).estimatedMessagesLeft).toBeNull();
  });

  it("trateaza 0 ca nelimitat si respecta comutatorul organizatiei", async () => {
    mockDb({
      org: { ai_enabled: true, monthly: 0, dailyPercent: 0 },
      usage: [{ user_id: "u1", day: "2026-09-13", messages: 999, cost_micros: 99_000_000 }],
    });
    const unlimited = await getQuotaStatus(CTX, NOW);
    expect(unlimited.blockedReason).toBeNull();
    expect(unlimited.warning).toBe(false);

    mockDb({ org: { ai_enabled: false, monthly: 2000, dailyPercent: 20 }, usage: [] });
    const disabled = await getQuotaStatus(CTX, NOW);
    expect(disabled.blockedReason).toBe("disabled");
    expect(quotaMessage(disabled)).toContain("dezactivat");
  });

  it("cade pe limitele implicite cand organizatia nu poate fi citita", async () => {
    mockDb({ org: null, usage: [] });

    const quota = await getQuotaStatus(CTX, NOW);

    expect(quota.monthlyLimit).toBe(DEFAULT_LIMITS.monthlyCredits);
    expect(quota.dailyPercent).toBe(DEFAULT_LIMITS.dailyPercent);
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

  it("intoarce costul apelului calculat de DB (pentru plafonul turei)", async () => {
    const { rpc } = mockDb({ org: null, usage: [] });
    rpc.mockResolvedValue({ data: "80666", error: null });
    await expect(
      recordUsage({ feature: "assistant", model: "m", usage: { inputTokens: 1, outputTokens: 1 } }),
    ).resolves.toBe(80666);
  });

  it("o eroare de contorizare nu strica raspunsul (se jurnalizeaza)", async () => {
    const { rpc } = mockDb({ org: null, usage: [] });
    rpc.mockResolvedValue({ error: { message: "boom" } });
    const error = vi.fn();
    vi.stubGlobal("console", { ...console, error });

    await expect(recordUsage({ feature: "assistant", messages: 1 })).resolves.toBe(0);
    expect(error).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
