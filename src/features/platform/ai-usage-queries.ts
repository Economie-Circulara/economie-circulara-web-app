import { createClient } from "@/lib/supabase/server";
import type { ModelPrice } from "./ai-pricing";

/**
 * Citiri pentru ecranul `/platform/ai` (super-admin). Tabelele din migrarea 0037 nu sunt
 * inca in `database.types.ts` (generat) - aceeasi granita netipata ca `assistant/db.ts`,
 * cu randurile tipate explicit aici. RLS: preturile si evenimentele sunt vizibile
 * super-adminului (`app.is_super_admin()`).
 */

interface UntypedClient {
  from(
    table:
      | "ai_model_prices"
      | "ai_usage_events"
      | "assistant_usage"
      | "organizations"
      | "ai_platform_settings"
      | "ai_credit_grants"
      | "ai_limit_changes"
      | "profiles",
  ): any;
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

export interface AiPlatformSettings {
  creditMicros: number;
  turnCreditLimit: number;
}

export async function getAiPlatformSettings(): Promise<AiPlatformSettings> {
  const client = await db();
  const { data } = await client
    .from("ai_platform_settings")
    .select("credit_micros, turn_credit_limit")
    .maybeSingle();
  return {
    creditMicros: data?.credit_micros ?? 1000,
    turnCreditLimit: data?.turn_credit_limit ?? 100,
  };
}

export interface AiLimitChange {
  id: string;
  type: "limits" | "grant";
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  changedBy: string | null;
  createdAt: string;
}

export interface OrganizationAiLimits {
  id: string;
  name: string;
  enabled: boolean;
  monthlyCredits: number;
  dailyPercent: number;
  /** Luna curenta: credite folosite (din cost) si credite extra acordate. */
  usedCredits: number;
  bonusCredits: number;
  /** Ultimele modificari (limite + top-up-uri), cele mai noi primele. */
  changes: AiLimitChange[];
}

interface OrgRow {
  id: string;
  name: string;
  ai_enabled: boolean;
  ai_monthly_credit_limit: number;
  ai_daily_user_credit_percent: number;
}

interface ChangeRow {
  id: string;
  organization_id: string;
  change_type: "limits" | "grant";
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
  changed_by: string | null;
  created_at: string;
}

/** Prima zi a lunii curente (UTC) - aceeasi conventie ca `assistant/quota.ts#monthStart`. */
function currentMonth(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Agregare pura: consumul lunii (micro-USD -> credite) si top-up-urile, pe organizatie. */
export function buildOrganizationAiLimits(input: {
  orgs: OrgRow[];
  usage: { organization_id: string; cost_micros: number | string }[];
  grants: { organization_id: string; credits: number }[];
  changes: ChangeRow[];
  emails: Map<string, string>;
  creditMicros: number;
  changesPerOrg?: number;
}): OrganizationAiLimits[] {
  const cost = new Map<string, number>();
  for (const row of input.usage) {
    cost.set(
      row.organization_id,
      (cost.get(row.organization_id) ?? 0) + (Number(row.cost_micros) || 0),
    );
  }
  const bonus = new Map<string, number>();
  for (const grant of input.grants) {
    bonus.set(grant.organization_id, (bonus.get(grant.organization_id) ?? 0) + grant.credits);
  }
  const changes = new Map<string, AiLimitChange[]>();
  for (const row of input.changes) {
    const list = changes.get(row.organization_id) ?? [];
    if (list.length >= (input.changesPerOrg ?? 5)) continue;
    list.push({
      id: row.id,
      type: row.change_type,
      before: row.before,
      after: row.after,
      changedBy: row.changed_by ? (input.emails.get(row.changed_by) ?? "utilizator șters") : null,
      createdAt: row.created_at,
    });
    changes.set(row.organization_id, list);
  }

  return input.orgs.map((org) => {
    const micros = cost.get(org.id) ?? 0;
    return {
      id: org.id,
      name: org.name,
      enabled: org.ai_enabled,
      monthlyCredits: org.ai_monthly_credit_limit,
      dailyPercent: org.ai_daily_user_credit_percent,
      usedCredits: micros > 0 ? Math.ceil(micros / Math.max(input.creditMicros, 1)) : 0,
      bonusCredits: bonus.get(org.id) ?? 0,
      changes: changes.get(org.id) ?? [],
    };
  });
}

/**
 * Limitele AI + situatia pe luna curenta a tuturor organizatiilor (super-admin: RLS
 * permite citirea completa pe `organizations`, `assistant_usage`, grant-uri si jurnal).
 */
export async function listOrganizationAiLimits(now = new Date()): Promise<OrganizationAiLimits[]> {
  const client = await db();
  const month = currentMonth(now);
  const [orgs, usage, grants, changes, settings] = await Promise.all([
    client
      .from("organizations")
      .select("id, name, ai_enabled, ai_monthly_credit_limit, ai_daily_user_credit_percent")
      .order("name"),
    client.from("assistant_usage").select("organization_id, cost_micros").gte("day", month),
    client.from("ai_credit_grants").select("organization_id, credits").eq("month", month),
    client
      .from("ai_limit_changes")
      .select("id, organization_id, change_type, before, after, changed_by, created_at")
      .order("created_at", { ascending: false })
      .limit(500),
    getAiPlatformSettings(),
  ]);
  if (orgs.error) throw new Error("Nu am putut încărca limitele AI ale organizațiilor.");

  const changeRows = (changes.data ?? []) as ChangeRow[];
  const authorIds = [
    ...new Set(changeRows.flatMap((row) => (row.changed_by ? [row.changed_by] : []))),
  ];
  const emails = new Map<string, string>();
  if (authorIds.length) {
    const { data } = await client.from("profiles").select("id, email").in("id", authorIds);
    for (const profile of (data ?? []) as { id: string; email: string | null }[]) {
      if (profile.email) emails.set(profile.id, profile.email);
    }
  }

  return buildOrganizationAiLimits({
    orgs: (orgs.data ?? []) as OrgRow[],
    usage: (usage.data ?? []) as { organization_id: string; cost_micros: number | string }[],
    grants: (grants.data ?? []) as { organization_id: string; credits: number }[],
    changes: changeRows,
    emails,
    creditMicros: settings.creditMicros,
  });
}
