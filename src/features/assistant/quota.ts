import { assistantDb, type AiPlatformSettingsRow, type OrganizationAiRow } from "./db";
import type { TokenUsage } from "./provider";
import type { QuotaStatus, ToolContext } from "./types";

/**
 * Quota asistentului, in CREDITE AI (docs/plans/asistent-consum-real.md, etapa 2).
 *
 * Costul real al fiecarui apel de model e masurat in DB (`assistant_record_usage`,
 * 0037); aici il transformam in credite: `credite = ceil(cost / valoarea_creditului)`
 * (`ai_platform_settings.credit_micros`, setata de super-admin). Asa un „salut” si un
 * import dintr-un PDF de 40 de pagini nu mai costa la fel.
 *
 * Doua limite:
 *  - lunara, per ORGANIZATIE - bugetul platit (`ai_monthly_credit_limit`);
 *  - zilnica, per UTILIZATOR - un PROCENT din bugetul lunar
 *    (`ai_daily_user_credit_percent`), ca un singur om sa nu consume tot bugetul echipei
 *    intr-o dupa-amiaza - scaleaza singura cu planul.
 *
 * Limita e MOALE: se verifica inainte de o tura; tura inceputa se termina chiar daca
 * depaseste bugetul (costul nu se stie dinainte). `0` = nelimitat.
 */

/** Limite implicite, folosite cand organizatia nu poate fi citita (ex. super-admin). */
export const DEFAULT_LIMITS = { monthlyCredits: 2000, dailyPercent: 20 } as const;
export const DEFAULT_CREDIT_SETTINGS = { creditMicros: 1000, turnCreditLimit: 100 } as const;
/** Pragul de avertizare (fractie din bugetul lunar). */
export const WARNING_THRESHOLD = 0.8;

/** Prima zi a lunii curente, in format `YYYY-MM-DD` (comparatie pe coloana `day`). */
export function monthStart(today = new Date()): string {
  return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function todayKey(today = new Date()): string {
  return today.toISOString().slice(0, 10);
}

/** Credite dintr-un cost (micro-USD), rotunjit in sus - un raspuns care a costat ceva e cel putin 1 credit. */
export function creditsFromMicros(costMicros: number, creditMicros: number): number {
  if (costMicros <= 0) return 0;
  return Math.ceil(costMicros / Math.max(creditMicros, 1));
}

export interface CreditSettings {
  creditMicros: number;
  /** Plafonul unei ture, in credite (0 = fara plafon). */
  turnCreditLimit: number;
}

/** Valoarea creditului + plafonul per tura (`ai_platform_settings`, 0039). */
export async function getCreditSettings(): Promise<CreditSettings> {
  const db = await assistantDb();
  const { data } = await db
    .from("ai_platform_settings")
    .select("credit_micros, turn_credit_limit")
    .maybeSingle();
  const row = data as AiPlatformSettingsRow | null;
  return row
    ? { creditMicros: row.credit_micros, turnCreditLimit: row.turn_credit_limit }
    : { ...DEFAULT_CREDIT_SETTINGS };
}

interface UsageAggregateRow {
  user_id: string;
  day: string;
  messages: number;
  cost_micros: number | string;
}

/** Calculul pur al quota-ei (testabil fara DB). */
export function computeQuota(input: {
  enabled: boolean;
  /** Bugetul lunar obisnuit (0 = nelimitat). */
  monthlyLimit: number;
  /** Top-up-urile lunii curente (docs/plans/asistent-credite-control-super-admin.md). */
  monthlyBonus?: number;
  dailyPercent: number;
  creditMicros: number;
  rows: UsageAggregateRow[];
  userId: string;
  today: string;
}): QuotaStatus {
  const cost = (row: UsageAggregateRow) => Number(row.cost_micros) || 0;
  const monthlyCost = input.rows.reduce((total, row) => total + cost(row), 0);
  const dailyCost = input.rows
    .filter((row) => row.day === input.today && row.user_id === input.userId)
    .reduce((total, row) => total + cost(row), 0);
  const messagesThisMonth = input.rows.reduce((total, row) => total + row.messages, 0);

  const monthlyUsed = creditsFromMicros(monthlyCost, input.creditMicros);
  const monthlyBase = input.monthlyLimit;
  // Nelimitat ramane nelimitat; altfel creditele extra se adauga peste buget.
  const monthlyBonus = monthlyBase > 0 ? Math.max(input.monthlyBonus ?? 0, 0) : 0;
  const monthlyLimit = monthlyBase > 0 ? monthlyBase + monthlyBonus : 0;
  const dailyUsed = creditsFromMicros(dailyCost, input.creditMicros);
  const dailyLimit =
    monthlyLimit > 0 && input.dailyPercent > 0
      ? Math.max(Math.ceil((monthlyLimit * input.dailyPercent) / 100), 1)
      : 0;

  // Estimarea „intrebari ramase” doar dupa ce avem cateva mesaje - altfel media minte.
  const averagePerMessage = messagesThisMonth >= 3 ? monthlyUsed / messagesThisMonth : null;
  const remaining = Math.max(monthlyLimit - monthlyUsed, 0);
  const estimatedMessagesLeft =
    monthlyLimit > 0 && averagePerMessage !== null
      ? Math.floor(remaining / Math.max(averagePerMessage, 1))
      : null;

  const status = {
    monthlyLimit,
    monthlyBase,
    monthlyBonus,
    monthlyUsed,
    dailyLimit,
    dailyUsed,
    dailyPercent: input.dailyPercent,
    messagesThisMonth,
    estimatedMessagesLeft,
    warning: monthlyLimit > 0 && monthlyUsed >= monthlyLimit * WARNING_THRESHOLD,
  };
  return { ...status, blockedReason: blockedReason({ enabled: input.enabled, ...status }) };
}

export async function getQuotaStatus(ctx: ToolContext, now = new Date()): Promise<QuotaStatus> {
  const db = await assistantDb();

  let monthlyLimit: number = DEFAULT_LIMITS.monthlyCredits;
  let dailyPercent: number = DEFAULT_LIMITS.dailyPercent;
  let enabled = true;

  const [orgResult, settings, usageResult, grantsResult] = await Promise.all([
    ctx.organizationId
      ? db
          .from("organizations")
          .select("ai_enabled, ai_monthly_credit_limit, ai_daily_user_credit_percent")
          .eq("id", ctx.organizationId)
          .single()
      : Promise.resolve({ data: null }),
    getCreditSettings(),
    db
      .from("assistant_usage")
      .select("user_id, day, messages, cost_micros")
      .gte("day", monthStart(now)),
    // Top-up-urile lunii (RLS: staff-ul organizatiei; clientul nu le vede).
    ctx.organizationId
      ? db
          .from("ai_credit_grants")
          .select("credits")
          .eq("organization_id", ctx.organizationId)
          .eq("month", monthStart(now))
      : Promise.resolve({ data: [] }),
  ]);

  const org = orgResult.data as OrganizationAiRow | null;
  if (org) {
    enabled = org.ai_enabled;
    monthlyLimit = org.ai_monthly_credit_limit;
    dailyPercent = org.ai_daily_user_credit_percent;
  }

  // Consumul lunar al organizatiei: RLS lasa staff-ul sa vada toate liniile org-ului,
  // iar un client doar pe ale lui - suma e corecta in ambele cazuri pentru ce se afiseaza.
  const monthlyBonus = ((grantsResult.data ?? []) as { credits: number }[]).reduce(
    (total, grant) => total + grant.credits,
    0,
  );

  return computeQuota({
    enabled,
    monthlyLimit,
    monthlyBonus,
    dailyPercent,
    creditMicros: settings.creditMicros,
    rows: (usageResult.data ?? []) as UsageAggregateRow[],
    userId: ctx.userId,
    today: todayKey(now),
  });
}

function blockedReason(input: {
  enabled: boolean;
  monthlyLimit: number;
  monthlyUsed: number;
  dailyLimit: number;
  dailyUsed: number;
}): QuotaStatus["blockedReason"] {
  if (!input.enabled) return "disabled";
  if (input.monthlyLimit > 0 && input.monthlyUsed >= input.monthlyLimit) return "monthly";
  if (input.dailyLimit > 0 && input.dailyUsed >= input.dailyLimit) return "daily";
  return null;
}

const credits = new Intl.NumberFormat("ro-RO");

/** Mesajul afisat utilizatorului cand quota il opreste. */
export function quotaMessage(quota: QuotaStatus): string | null {
  switch (quota.blockedReason) {
    case "disabled":
      return "Asistentul AI este dezactivat pentru organizația ta. Un administrator îl poate activa din Setări.";
    case "monthly":
      return `Organizația a folosit toate cele ${credits.format(quota.monthlyLimit)} credite AI incluse luna aceasta. Bugetul se reînnoiește la începutul lunii viitoare; pentru mai multe credite, contactați-ne pentru un plan extins.`;
    case "daily":
      return `Ai folosit azi toate cele ${credits.format(quota.dailyLimit)} credite AI ale tale (${quota.dailyPercent}% din bugetul lunar al organizației). Poți continua mâine; limita există ca bugetul să ajungă pentru toată echipa.`;
    default:
      return null;
  }
}

/** Ce functie AI a consumat - coloana `ai_usage_events.feature` (migrarea 0037). */
export type UsageFeature = "assistant" | "recipe_extract";

/** Argumentele RPC-ului `assistant_record_usage` (pur - testabil fara DB). */
export function recordUsageArgs(input: {
  feature: UsageFeature;
  messages?: number;
  model?: string | null;
  conversationId?: string | null;
  usage?: TokenUsage;
}): Record<string, string | number | null> {
  const usage = input.usage;
  const hit = Math.max(usage?.cacheHitTokens ?? 0, 0);
  // Fara detaliere de la furnizor, tot input-ul e considerat NOU (nu subestimam costul).
  const miss = Math.max(usage?.cacheMissTokens ?? (usage?.inputTokens ?? 0) - hit, 0);
  return {
    p_feature: input.feature,
    p_model: input.model ?? null,
    p_conversation_id: input.conversationId ?? null,
    p_messages: input.messages ?? 0,
    p_input_cache_hit: Math.round(hit),
    p_input_cache_miss: Math.round(miss),
    p_output_tokens: Math.round(Math.max(usage?.outputTokens ?? 0, 0)),
    p_reasoning_tokens: Math.round(Math.max(usage?.reasoningTokens ?? 0, 0)),
  };
}

/**
 * PUNCTUL UNIC de contorizare (docs/plans/asistent-consum-real.md): orice mesaj al
 * utilizatorului (`messages: 1`, fara model) si orice apel de model (`model` + `usage`)
 * trec pe aici. Costul il calculeaza DB-ul (`assistant_record_usage`, 0037) cu pretul
 * valabil acum - aplicatia raporteaza doar tokeni. Esecul contorizarii nu strica
 * raspunsul utilizatorului: se jurnalizeaza si atat.
 */
export async function recordUsage(input: Parameters<typeof recordUsageArgs>[0]): Promise<number> {
  const args = recordUsageArgs(input);
  // Nimic de inregistrat: nici mesaj, nici apel de model (ex. furnizorul mock).
  if (!args.p_messages && !args.p_model) return 0;
  const db = await assistantDb();
  const { data, error } = await db.rpc("assistant_record_usage", args);
  if (error) {
    console.error("[asistent] contorizarea consumului a esuat", error);
    return 0;
  }
  // Costul apelului, in micro-USD (RPC-ul il intoarce) - pentru plafonul per tura.
  return Number(data) || 0;
}
