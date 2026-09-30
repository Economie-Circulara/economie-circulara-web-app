import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { buildUsageInsights, confirmationRate, parseInsightDays, usageSignals } =
  await import("./ai-usage-insights");

const toolKinds = new Map([
  ["cauta_stoc", "read" as const],
  ["creeaza_client", "write" as const],
]);

function totals(overrides: Partial<Parameters<typeof usageSignals>[0]> = {}) {
  return {
    conversations: 1,
    messages: 10,
    costMicros: 10_000,
    reads: 5,
    proposals: 0,
    confirmed: 0,
    rejected: 0,
    failed: 0,
    pending: 0,
    readFailures: 0,
    ...overrides,
  };
}

describe("buildUsageInsights", () => {
  const insights = buildUsageInsights({
    activity: [
      {
        organization_id: "org-a",
        user_id: "u1",
        conversations: "2", // `bigint` vine ca string din PostgREST
        user_messages: "8",
        active_days: "3",
        last_active_at: "2026-09-29T10:00:00Z",
      },
      {
        organization_id: "org-a",
        user_id: "u2",
        conversations: 1,
        user_messages: 2,
        active_days: 1,
        last_active_at: "2026-09-20T10:00:00Z",
      },
    ],
    tools: [
      {
        organization_id: "org-a",
        user_id: "u1",
        tool: "cauta_stoc",
        status: "confirmed",
        calls: 6,
      },
      { organization_id: "org-a", user_id: "u1", tool: "cauta_stoc", status: "failed", calls: 1 },
      {
        organization_id: "org-a",
        user_id: "u1",
        tool: "creeaza_client",
        status: "confirmed",
        calls: 1,
      },
      {
        organization_id: "org-a",
        user_id: "u2",
        tool: "creeaza_client",
        status: "rejected",
        calls: 3,
      },
      {
        organization_id: "org-a",
        user_id: "u2",
        tool: "creeaza_client",
        status: "proposed",
        calls: 1,
      },
      // tool scos din registru: `proposed` => a fost o scriere
      { organization_id: "org-a", user_id: "u2", tool: "vechi", status: "proposed", calls: 2 },
    ],
    costs: [
      { organization_id: "org-a", user_id: "u1", cost_micros: "4000" },
      { organization_id: "org-a", user_id: "u2", cost_micros: 1000 },
    ],
    profiles: new Map([
      ["u1", { email: "ana@a.ro", role: "operator" as const }],
      ["u2", { email: "ion@a.ro", role: "admin" as const }],
    ]),
    orgNames: new Map([["org-a", "ACME"]]),
    toolKinds,
  });

  it("separa citirile de propuneri si numara soarta propunerilor", () => {
    const u1 = insights.byUser.find((row) => row.userId === "u1")!;
    expect(u1).toMatchObject({
      email: "ana@a.ro",
      organizationName: "ACME",
      messages: 8,
      reads: 6,
      readFailures: 1,
      proposals: 1,
      confirmed: 1,
      costMicros: 4000,
    });
    const u2 = insights.byUser.find((row) => row.userId === "u2")!;
    expect(u2).toMatchObject({ proposals: 6, rejected: 3, pending: 3 });
  });

  it("pune primii utilizatorii cu semnale si numara organizatia", () => {
    expect(insights.byUser[0].userId).toBe("u2");
    expect(insights.byUser[0].signals).toEqual(["many_rejections", "abandoned_proposals"]);
    expect(insights.byOrganization).toEqual([
      expect.objectContaining({
        organizationName: "ACME",
        activeUsers: 2,
        flaggedUsers: 1,
        messages: 10,
        costMicros: 5000,
      }),
    ]);
    expect(insights.total).toMatchObject({ activeUsers: 2, proposals: 7, confirmed: 1 });
  });

  it("agrega pe tool, cu tipul din registru (null = retras)", () => {
    expect(insights.byTool).toEqual([
      expect.objectContaining({ tool: "cauta_stoc", kind: "read", calls: 7, failed: 1 }),
      expect.objectContaining({ tool: "creeaza_client", kind: "write", calls: 5, rejected: 3 }),
      expect.objectContaining({ tool: "vechi", kind: null, pending: 2 }),
    ]);
  });

  it("un utilizator doar cu cost (fara mesaje) nu e numarat activ", () => {
    const result = buildUsageInsights({
      activity: [],
      tools: [],
      costs: [{ organization_id: "org-a", user_id: "u9", cost_micros: 100 }],
      profiles: new Map(),
      orgNames: new Map(),
      toolKinds,
    });
    expect(result.total.activeUsers).toBe(0);
    expect(result.byUser[0]).toMatchObject({
      email: "utilizator șters",
      organizationName: "Organizație ștearsă",
    });
  });
});

describe("usageSignals", () => {
  it("fara semnale la o utilizare normala", () => {
    expect(usageSignals(totals({ proposals: 5, confirmed: 4, rejected: 1 }), 1000)).toEqual([]);
  });

  it("respingeri: minim 3 si minim 30% din propuneri", () => {
    expect(usageSignals(totals({ proposals: 10, rejected: 3, confirmed: 7 }), 1000)).toEqual([
      "many_rejections",
    ]);
    expect(usageSignals(totals({ proposals: 20, rejected: 3, confirmed: 17 }), 1000)).toEqual([]);
  });

  it("erori: include si citirile esuate", () => {
    expect(usageSignals(totals({ reads: 5, readFailures: 3 }), 1000)).toEqual(["many_failures"]);
  });

  it("doar chat: multe mesaje, niciun apel de date", () => {
    expect(usageSignals(totals({ messages: 20, reads: 0 }), 1000)).toEqual(["chat_only"]);
  });

  it("cost mare pe mesaj: peste 3x media, minim 5 mesaje", () => {
    expect(usageSignals(totals({ messages: 5, costMicros: 20_000 }), 1000)).toEqual([
      "high_cost_per_message",
    ]);
    expect(usageSignals(totals({ messages: 4, costMicros: 20_000 }), 1000)).toEqual([]);
  });
});

describe("confirmationRate", () => {
  it("ignora propunerile fara raspuns", () => {
    expect(confirmationRate(totals({ confirmed: 3, rejected: 1, pending: 10 }))).toBe(75);
    expect(confirmationRate(totals())).toBeNull();
  });
});

describe("parseInsightDays", () => {
  it("accepta doar perioadele permise", () => {
    expect(parseInsightDays("7")).toBe(7);
    expect(parseInsightDays(["90"])).toBe(90);
    expect(parseInsightDays("365")).toBe(30);
    expect(parseInsightDays(undefined)).toBe(30);
  });
});
