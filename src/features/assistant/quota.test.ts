import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ToolContext } from "./types";

vi.mock("./db", () => ({ assistantDb: vi.fn() }));

const { assistantDb } = await import("./db");
const { DEFAULT_LIMITS, getQuotaStatus, monthStart, quotaMessage, trackUsage } =
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

describe("trackUsage", () => {
  it("incrementeaza atomic, prin RPC", async () => {
    const { rpc } = mockDb({ org: null, usage: [] });

    await trackUsage({ messages: 1, inputTokens: 120, outputTokens: 45 });

    expect(rpc).toHaveBeenCalledWith("assistant_track_usage", {
      p_messages: 1,
      p_input_tokens: 120,
      p_output_tokens: 45,
    });
  });
});
