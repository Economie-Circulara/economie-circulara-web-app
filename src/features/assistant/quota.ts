import { assistantDb, type AssistantUsageRow, type OrganizationAiRow } from "./db";
import type { TokenUsage } from "./provider";
import type { QuotaStatus, ToolContext } from "./types";

/**
 * Quota asistentului. Numaram MESAJE, nu tokeni: e usor de explicat clientului
 * ("200 de mesaje pe luna") si de pus pe un card de pret. In paralel se masoara exact
 * tokenii (cache / nou / output) si costul fiecarui apel de model (`recordUsage`,
 * migrarea 0037) - baza pentru trecerea la credite (docs/plans/asistent-consum-real.md).
 *
 * Doua limite, ca sa fie si corect, si previzibil:
 *  - lunara, per ORGANIZATIE - bugetul platit;
 *  - zilnica, per UTILIZATOR - ca un singur om sa nu consume tot bugetul echipei
 *    intr-o dupa-amiaza.
 *
 * `0` inseamna nelimitat (rezervat pentru un plan platit).
 */

/** Limite implicite, folosite cand organizatia nu poate fi citita (ex. super-admin). */
export const DEFAULT_LIMITS = { monthly: 200, daily: 20 } as const;

/** Prima zi a lunii curente, in format `YYYY-MM-DD` (comparatie pe coloana `day`). */
export function monthStart(today = new Date()): string {
  return `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

export function todayKey(today = new Date()): string {
  return today.toISOString().slice(0, 10);
}

export async function getQuotaStatus(ctx: ToolContext, now = new Date()): Promise<QuotaStatus> {
  const db = await assistantDb();

  let monthlyLimit: number = DEFAULT_LIMITS.monthly;
  let dailyLimit: number = DEFAULT_LIMITS.daily;
  let enabled = true;

  if (ctx.organizationId) {
    const { data } = await db
      .from("organizations")
      .select("ai_enabled, ai_monthly_message_limit, ai_daily_user_message_limit")
      .eq("id", ctx.organizationId)
      .single();

    const org = data as OrganizationAiRow | null;
    if (org) {
      enabled = org.ai_enabled;
      monthlyLimit = org.ai_monthly_message_limit;
      dailyLimit = org.ai_daily_user_message_limit;
    }
  }

  const { data: rows } = await db
    .from("assistant_usage")
    .select("user_id, day, messages")
    .gte("day", monthStart(now));

  const usage = (rows ?? []) as Pick<AssistantUsageRow, "user_id" | "day" | "messages">[];
  const today = todayKey(now);

  // Consumul lunar al organizatiei: RLS lasa staff-ul sa vada toate liniile org-ului,
  // iar un client doar pe ale lui - suma e corecta in ambele cazuri pentru ce se afiseaza.
  const monthlyUsed = usage.reduce((total, row) => total + row.messages, 0);
  const dailyUsed = usage
    .filter((row) => row.day === today && row.user_id === ctx.userId)
    .reduce((total, row) => total + row.messages, 0);

  return {
    monthlyLimit,
    monthlyUsed,
    dailyLimit,
    dailyUsed,
    blockedReason: blockedReason({ enabled, monthlyLimit, monthlyUsed, dailyLimit, dailyUsed }),
  };
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

/** Mesajul afisat utilizatorului cand quota il opreste. */
export function quotaMessage(quota: QuotaStatus): string | null {
  switch (quota.blockedReason) {
    case "disabled":
      return "Asistentul AI este dezactivat pentru organizația ta. Un administrator îl poate activa din Setări.";
    case "monthly":
      return `Ați folosit toate cele ${quota.monthlyLimit} mesaje incluse luna aceasta. Limita se resetează la începutul lunii viitoare; pentru mai multe mesaje, contactați-ne pentru un plan extins.`;
    case "daily":
      return `Ai atins limita zilnică de ${quota.dailyLimit} mesaje. Încearcă din nou mâine sau cere unui administrator un plan extins.`;
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
export async function recordUsage(input: Parameters<typeof recordUsageArgs>[0]): Promise<void> {
  const args = recordUsageArgs(input);
  // Nimic de inregistrat: nici mesaj, nici apel de model (ex. furnizorul mock).
  if (!args.p_messages && !args.p_model) return;
  const db = await assistantDb();
  const { error } = await db.rpc("assistant_record_usage", args);
  if (error) console.error("[asistent] contorizarea consumului a esuat", error);
}
