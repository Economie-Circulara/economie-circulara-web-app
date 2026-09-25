import { createClient } from "@/lib/supabase/server";
import type { ModelPrice } from "./ai-pricing";

/**
 * Citiri pentru ecranul `/platform/ai` (super-admin). Tabelele din migrarea 0037 nu sunt
 * inca in `database.types.ts` (generat) - aceeasi granita netipata ca `assistant/db.ts`,
 * cu randurile tipate explicit aici. RLS: preturile si evenimentele sunt vizibile
 * super-adminului (`app.is_super_admin()`).
 */

interface UntypedClient {
  from(table: "ai_model_prices" | "ai_usage_events" | "assistant_usage" | "organizations"): any;
}

async function db(): Promise<UntypedClient> {
  return (await createClient()) as unknown as UntypedClient;
}

interface PriceRow {
  id: string;
  model: string;
  input_cache_hit_per_m: number | string;
  input_cache_miss_per_m: number | string;
  output_per_m: number | string;
  valid_from: string;
  note: string | null;
  created_at: string;
}

export async function listModelPrices(): Promise<ModelPrice[]> {
  const client = await db();
  const { data, error } = await client
    .from("ai_model_prices")
    .select(
      "id, model, input_cache_hit_per_m, input_cache_miss_per_m, output_per_m, valid_from, note, created_at",
    )
    .order("model")
    .order("valid_from", { ascending: false });
  if (error) throw new Error("Nu am putut încărca prețurile modelelor.");
  return ((data ?? []) as PriceRow[]).map((row) => ({
    id: row.id,
    model: row.model,
    // `numeric` vine ca string din PostgREST
    inputCacheHitPerM: Number(row.input_cache_hit_per_m),
    inputCacheMissPerM: Number(row.input_cache_miss_per_m),
    outputPerM: Number(row.output_per_m),
    validFrom: row.valid_from,
    note: row.note,
    createdAt: row.created_at,
  }));
}

export interface UsageEventRow {
  organization_id: string | null;
  model: string;
  input_cache_hit: number;
  input_cache_miss: number;
  output_tokens: number;
  cost_micros: number | string;
  default_price_used: boolean;
}

export interface UsageTotals {
  requests: number;
  inputCacheHit: number;
  inputCacheMiss: number;
  output: number;
  costMicros: number;
}

export interface OrganizationUsage extends UsageTotals {
  organizationId: string | null;
  organizationName: string;
  messages: number;
}

export interface ModelUsage extends UsageTotals {
  model: string;
  /** Apeluri taxate cu pretul implicit `*` - modelul are nevoie de pret propriu. */
  defaultPriceRequests: number;
}

function emptyTotals(): UsageTotals {
  return { requests: 0, inputCacheHit: 0, inputCacheMiss: 0, output: 0, costMicros: 0 };
}

function add(totals: UsageTotals, row: UsageEventRow) {
  totals.requests += 1;
  totals.inputCacheHit += row.input_cache_hit;
  totals.inputCacheMiss += row.input_cache_miss;
  totals.output += row.output_tokens;
  totals.costMicros += Number(row.cost_micros);
}

/** Agregare pura (testabila): pe organizatie si pe model. */
export function aggregateUsage(
  events: UsageEventRow[],
  messagesByOrg: Map<string, number>,
  orgNames: Map<string, string>,
): { byOrganization: OrganizationUsage[]; byModel: ModelUsage[]; total: UsageTotals } {
  const byOrg = new Map<string, OrganizationUsage>();
  const byModel = new Map<string, ModelUsage>();
  const total = emptyTotals();

  for (const event of events) {
    const key = event.organization_id ?? "";
    const org =
      byOrg.get(key) ??
      ({
        ...emptyTotals(),
        organizationId: event.organization_id,
        organizationName: event.organization_id
          ? (orgNames.get(event.organization_id) ?? "Organizație ștearsă")
          : "Fără organizație (super-admin)",
        messages: event.organization_id ? (messagesByOrg.get(event.organization_id) ?? 0) : 0,
      } satisfies OrganizationUsage);
    add(org, event);
    byOrg.set(key, org);

    const model =
      byModel.get(event.model) ??
      ({ ...emptyTotals(), model: event.model, defaultPriceRequests: 0 } satisfies ModelUsage);
    add(model, event);
    if (event.default_price_used) model.defaultPriceRequests += 1;
    byModel.set(event.model, model);

    add(total, event);
  }

  return {
    byOrganization: [...byOrg.values()].sort((a, b) => b.costMicros - a.costMicros),
    byModel: [...byModel.values()].sort((a, b) => b.costMicros - a.costMicros),
    total,
  };
}

/** Consumul din ultimele `days` zile, pe organizatie si pe model. */
export async function usageSummary(days = 30, now = new Date()) {
  const client = await db();
  const since = new Date(now.getTime() - days * 24 * 3600 * 1000);
  const sinceDay = since.toISOString().slice(0, 10);

  const [events, usage, orgs] = await Promise.all([
    client
      .from("ai_usage_events")
      .select(
        "organization_id, model, input_cache_hit, input_cache_miss, output_tokens, cost_micros, default_price_used",
      )
      .gte("created_at", since.toISOString())
      .limit(50000),
    client.from("assistant_usage").select("organization_id, messages").gte("day", sinceDay),
    client.from("organizations").select("id, name"),
  ]);
  if (events.error) throw new Error("Nu am putut încărca consumul AI.");

  const messagesByOrg = new Map<string, number>();
  for (const row of (usage.data ?? []) as { organization_id: string; messages: number }[]) {
    messagesByOrg.set(
      row.organization_id,
      (messagesByOrg.get(row.organization_id) ?? 0) + row.messages,
    );
  }
  const orgNames = new Map(
    ((orgs.data ?? []) as { id: string; name: string }[]).map((org) => [org.id, org.name]),
  );

  return {
    days,
    ...aggregateUsage((events.data ?? []) as UsageEventRow[], messagesByOrg, orgNames),
  };
}
