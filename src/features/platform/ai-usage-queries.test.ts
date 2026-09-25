import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

const { aggregateUsage } = await import("./ai-usage-queries");

function event(organizationId: string | null, model: string, cost: number, defaultPrice = false) {
  return {
    organization_id: organizationId,
    model,
    input_cache_hit: 800,
    input_cache_miss: 200,
    output_tokens: 50,
    cost_micros: String(cost), // `bigint` vine ca string din PostgREST
    default_price_used: defaultPrice,
  };
}

describe("aggregateUsage", () => {
  it("insumeaza pe organizatie si pe model, sortat dupa cost, cu mesajele din quota", () => {
    const result = aggregateUsage(
      [
        event("org-a", "deepseek-v4-pro", 2600),
        event("org-a", "deepseek-v4-pro", 2400),
        event("org-b", "deepseek-flash", 300),
        event("org-b", "model-nou", 1000, true),
        event(null, "deepseek-flash", 100),
      ],
      new Map([
        ["org-a", 2],
        ["org-b", 5],
      ]),
      new Map([
        ["org-a", "ACME"],
        ["org-b", "Beta"],
      ]),
    );

    expect(result.total).toMatchObject({ requests: 5, costMicros: 6400, inputCacheHit: 4000 });
    expect(
      result.byOrganization.map((row) => [
        row.organizationName,
        row.requests,
        row.costMicros,
        row.messages,
      ]),
    ).toEqual([
      ["ACME", 2, 5000, 2],
      ["Beta", 2, 1300, 5],
      ["Fără organizație (super-admin)", 1, 100, 0],
    ]);
    expect(result.byModel.find((row) => row.model === "model-nou")?.defaultPriceRequests).toBe(1);
    expect(result.byModel[0].model).toBe("deepseek-v4-pro");
  });
});
