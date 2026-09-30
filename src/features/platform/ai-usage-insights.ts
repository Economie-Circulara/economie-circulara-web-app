import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/features/auth/session";

/**
 * Utilizarea asistentului AI, vazuta de super-admin (`/platform/ai/utilizare`,
 * docs/plans/asistent-utilizare-super-admin.md). DOAR contoare: conversatiile raman
 * personale, RPC-urile din migrarea 0051 nu intorc niciun text. Aceeasi granita netipata
 * ca `ai-usage-queries.ts` (0037/0051 nu sunt inca in `database.types.ts`).
 */

interface UntypedClient {
  from(table: "ai_usage_events" | "organizations" | "profiles"): any;
  rpc(fn: "platform_ai_user_activity" | "platform_ai_tool_activity", args: object): any;
}

async function db(): Promise<UntypedClient> {
  return (await createClient()) as unknown as UntypedClient;
}

export type ToolKind = "read" | "write";
export type ToolStatus = "proposed" | "executing" | "confirmed" | "rejected" | "failed";

export interface UserActivityRow {
  organization_id: string | null;
  user_id: string;
  conversations: number | string;
  user_messages: number | string;
  active_days: number | string;
  last_active_at: string | null;
}

export interface ToolActivityRow {
  organization_id: string | null;
  user_id: string;
  tool: string;
  status: ToolStatus;
  calls: number | string;
}

export interface CostRow {
  organization_id: string | null;
  user_id: string;
  cost_micros: number | string;
}

export interface ProfileInfo {
  email: string | null;
  role: UserRole | null;
}

export interface ToolCounts {
  /** Tool-uri de citire executate (fara efecte). */
  reads: number;
  /** Propuneri de scriere, pe soarta lor. */
  proposals: number;
  confirmed: number;
  rejected: number;
  failed: number;
  /** Propuneri ramase fara raspuns (sau blocate in executie). */
  pending: number;
  /** Esecuri si la citiri - date/argumente gresite. */
  readFailures: number;
}

export interface ActivityTotals extends ToolCounts {
  conversations: number;
  messages: number;
  costMicros: number;
}

export type UsageSignal =
  | "many_rejections"
  | "many_failures"
  | "abandoned_proposals"
  | "chat_only"
  | "high_cost_per_message";

export const USAGE_SIGNAL_LABELS: Record<UsageSignal, string> = {
  many_rejections: "Multe propuneri respinse",
  many_failures: "Multe erori",
  abandoned_proposals: "Propuneri lăsate fără răspuns",
  chat_only: "Doar conversație, fără date",
  high_cost_per_message: "Cost mare pe mesaj",
};

export const USAGE_SIGNAL_HINTS: Record<UsageSignal, string> = {
  many_rejections:
    "Asistentul propune altceva decât vrea utilizatorul - cereri neclare sau prompt de ajustat.",
  many_failures: "Acțiunile cad la execuție - date lipsă sau argumente greșite.",
  abandoned_proposals: "Utilizatorul nu confirmă și nu respinge cardurile de acțiune.",
  chat_only: "Multe mesaje fără nicio citire de date - folosit ca chat generic.",
  high_cost_per_message:
    "Peste 3x costul mediu pe mesaj al platformei - conversații foarte lungi sau atașamente mari.",
};

export interface UserActivity extends ActivityTotals {
  userId: string;
  organizationId: string | null;
  organizationName: string;
  email: string;
  role: UserRole | null;
  activeDays: number;
  lastActiveAt: string | null;
  signals: UsageSignal[];
}

export interface OrganizationActivity extends ActivityTotals {
  organizationId: string | null;
  organizationName: string;
  activeUsers: number;
  flaggedUsers: number;
}

export interface ToolActivity {
  tool: string;
  kind: ToolKind | null;
  calls: number;
  confirmed: number;
  rejected: number;
  failed: number;
  pending: number;
}

export interface UsageInsights {
  total: ActivityTotals & { activeUsers: number };
  byOrganization: OrganizationActivity[];
  byUser: UserActivity[];
  byTool: ToolActivity[];
}

function emptyTotals(): ActivityTotals {
  return {
    conversations: 0,
    messages: 0,
    costMicros: 0,
    reads: 0,
    proposals: 0,
    confirmed: 0,
    rejected: 0,
    failed: 0,
    pending: 0,
    readFailures: 0,
  };
}

const TOTAL_KEYS = Object.keys(emptyTotals()) as (keyof ActivityTotals)[];

function addTotals(target: ActivityTotals, source: ActivityTotals) {
  // Doar cheile de contor - `target` poate avea si campuri proprii (nume, activeUsers...).
  for (const key of TOTAL_KEYS) {
    target[key] += source[key];
  }
}

/** Adauga `calls` apeluri ale unui tool cu un status la contoare. */
function addToolCalls(
  target: ToolCounts,
  kind: ToolKind | null,
  status: ToolStatus,
  calls: number,
) {
  // Un tool necunoscut (scos din registru) cu status `proposed` a fost, sigur, o scriere.
  const isWrite = kind === "write" || (kind === null && status !== "confirmed");
  if (!isWrite) {
    if (status === "failed") target.readFailures += calls;
    else target.reads += calls;
    return;
  }
  target.proposals += calls;
  if (status === "confirmed") target.confirmed += calls;
  else if (status === "rejected") target.rejected += calls;
  else if (status === "failed") target.failed += calls;
  else target.pending += calls;
}

/** Rata de confirmare a propunerilor rezolvate (fara cele in asteptare), 0-100 sau null. */
export function confirmationRate(counts: ToolCounts): number | null {
  const resolved = counts.confirmed + counts.rejected + counts.failed;
  return resolved ? Math.round((counts.confirmed / resolved) * 100) : null;
}

/**
 * Semnalele de utilizare problematica (euristici simple, pragurile din plan).
 * `avgCostPerMessage` = media platformei, in micro-USD.
 */
export function usageSignals(user: ActivityTotals, avgCostPerMessage: number): UsageSignal[] {
  const signals: UsageSignal[] = [];
  if (user.rejected >= 3 && user.rejected >= 0.3 * user.proposals) signals.push("many_rejections");
  const failures = user.failed + user.readFailures;
  const calls = user.proposals + user.reads + user.readFailures;
  if (failures >= 3 && failures >= 0.2 * calls) signals.push("many_failures");
  if (user.pending >= 3) signals.push("abandoned_proposals");
  if (user.messages >= 20 && calls === 0) signals.push("chat_only");
  if (
    user.messages >= 5 &&
    avgCostPerMessage > 0 &&
    user.costMicros / user.messages > 3 * avgCostPerMessage
  ) {
    signals.push("high_cost_per_message");
  }
  return signals;
}

/** Agregare pura (testabila): pe utilizator, pe organizatie si pe tool. */
export function buildUsageInsights(input: {
  activity: UserActivityRow[];
  tools: ToolActivityRow[];
  costs: CostRow[];
  profiles: Map<string, ProfileInfo>;
  orgNames: Map<string, string>;
  toolKinds: Map<string, ToolKind>;
}): UsageInsights {
  const users = new Map<string, UserActivity>();
  const userFor = (organizationId: string | null, userId: string): UserActivity => {
    const key = `${organizationId ?? ""}:${userId}`;
    let user = users.get(key);
    if (!user) {
      const profile = input.profiles.get(userId);
      user = {
        ...emptyTotals(),
        userId,
        organizationId,
        organizationName: organizationId
          ? (input.orgNames.get(organizationId) ?? "Organizație ștearsă")
          : "Fără organizație (super-admin)",
        email: profile?.email ?? "utilizator șters",
        role: profile?.role ?? null,
        activeDays: 0,
        lastActiveAt: null,
        signals: [],
      };
      users.set(key, user);
    }
    return user;
  };

  for (const row of input.activity) {
    const user = userFor(row.organization_id, row.user_id);
    user.conversations += Number(row.conversations);
    user.messages += Number(row.user_messages);
    user.activeDays += Number(row.active_days);
    user.lastActiveAt = row.last_active_at;
  }

  const tools = new Map<string, ToolActivity>();
  for (const row of input.tools) {
    const calls = Number(row.calls);
    const kind = input.toolKinds.get(row.tool) ?? null;
    addToolCalls(userFor(row.organization_id, row.user_id), kind, row.status, calls);

    const tool =
      tools.get(row.tool) ??
      ({
        tool: row.tool,
        kind,
        calls: 0,
        confirmed: 0,
        rejected: 0,
        failed: 0,
        pending: 0,
      } satisfies ToolActivity);
    tool.calls += calls;
    if (row.status === "confirmed") tool.confirmed += calls;
    else if (row.status === "rejected") tool.rejected += calls;
    else if (row.status === "failed") tool.failed += calls;
    else tool.pending += calls;
    tools.set(row.tool, tool);
  }

  for (const row of input.costs) {
    userFor(row.organization_id, row.user_id).costMicros += Number(row.cost_micros) || 0;
  }

  const total = { ...emptyTotals(), activeUsers: 0 };
  for (const user of users.values()) addTotals(total, user);
  const avgCostPerMessage = total.messages ? total.costMicros / total.messages : 0;

  const orgs = new Map<string, OrganizationActivity>();
  for (const user of users.values()) {
    user.signals = usageSignals(user, avgCostPerMessage);
    if (user.messages > 0) total.activeUsers += 1;

    const key = user.organizationId ?? "";
    const org =
      orgs.get(key) ??
      ({
        ...emptyTotals(),
        organizationId: user.organizationId,
        organizationName: user.organizationName,
        activeUsers: 0,
        flaggedUsers: 0,
      } satisfies OrganizationActivity);
    addTotals(org, user);
    if (user.messages > 0) org.activeUsers += 1;
    if (user.signals.length) org.flaggedUsers += 1;
    orgs.set(key, org);
  }

  return {
    total,
    byOrganization: [...orgs.values()].sort((a, b) => b.messages - a.messages),
    // Cei cu semnale primii, apoi dupa activitate.
    byUser: [...users.values()].sort(
      (a, b) => b.signals.length - a.signals.length || b.messages - a.messages,
    ),
    byTool: [...tools.values()].sort((a, b) => b.calls - a.calls),
  };
}

/** Utilizarea din ultimele `days` zile. `toolKinds` vine din registrul asistentului. */
export async function usageInsights(
  days: number,
  toolKinds: Map<string, ToolKind>,
  now = new Date(),
): Promise<UsageInsights> {
  const client = await db();
  const since = new Date(now.getTime() - days * 24 * 3600 * 1000).toISOString();

  const [activity, tools, costs, orgs] = await Promise.all([
    client.rpc("platform_ai_user_activity", { p_since: since }),
    client.rpc("platform_ai_tool_activity", { p_since: since }),
    client
      .from("ai_usage_events")
      .select("organization_id, user_id, cost_micros")
      .gte("created_at", since)
      .limit(50000),
    client.from("organizations").select("id, name"),
  ]);
  if (activity.error || tools.error) {
    throw new Error("Nu am putut încărca utilizarea asistentului.");
  }

  const activityRows = (activity.data ?? []) as UserActivityRow[];
  const toolRows = (tools.data ?? []) as ToolActivityRow[];
  const costRows = (costs.data ?? []) as CostRow[];
  const userIds = [
    ...new Set([...activityRows, ...toolRows, ...costRows].map((row) => row.user_id)),
  ];
  const profiles = new Map<string, ProfileInfo>();
  if (userIds.length) {
    const { data } = await client.from("profiles").select("id, email, role").in("id", userIds);
    for (const profile of (data ?? []) as {
      id: string;
      email: string | null;
      role: UserRole | null;
    }[]) {
      profiles.set(profile.id, { email: profile.email, role: profile.role });
    }
  }

  return buildUsageInsights({
    activity: activityRows,
    tools: toolRows,
    costs: costRows,
    profiles,
    orgNames: new Map(
      ((orgs.data ?? []) as { id: string; name: string }[]).map((org) => [org.id, org.name]),
    ),
    toolKinds,
  });
}

export const INSIGHT_PERIODS = [7, 30, 90] as const;

/** Perioada din `?zile=` - doar valorile din `INSIGHT_PERIODS`, implicit 30. */
export function parseInsightDays(value: string | string[] | undefined): number {
  const days = Number(Array.isArray(value) ? value[0] : value);
  return (INSIGHT_PERIODS as readonly number[]).includes(days) ? days : 30;
}
