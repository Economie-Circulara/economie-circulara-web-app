import type { Json } from "@/lib/database.types";
import { createClient } from "@/lib/supabase/server";

/**
 * Acces la tabelele de asistent, cu tipuri scrise de mana.
 *
 * `src/lib/database.types.ts` e GENERAT (`pnpm gen:types`, care cere stack-ul Supabase
 * local) si NU se editeaza manual - vezi AGENTS.md. Pana cand cineva ruleaza generarea
 * dupa migrarea `0020_assistant.sql`, tabelele noi nu exista in tipul `Database`, deci
 * clientul tipat le respinge. Solutia temporara: o singura granita `any`, aici, cu
 * randurile tipate explicit mai jos - nu se imprastie `any` prin feature.
 *
 * De sters dupa `pnpm db:reset && pnpm gen:types`: atunci `createClient()` stie tabelele
 * si `assistantDb()` poate fi inlocuit cu clientul normal.
 */

export interface AssistantConversationRow {
  id: string;
  organization_id: string | null;
  user_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssistantMessageRow {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  created_at: string;
}

export interface AssistantToolCallRow {
  id: string;
  conversation_id: string;
  tool: string;
  arguments: Json;
  status: "proposed" | "confirmed" | "rejected" | "failed";
  result: Json | null;
  error: string | null;
  confirmed_by: string | null;
  created_at: string;
  resolved_at: string | null;
}

export interface AssistantUsageRow {
  organization_id: string | null;
  user_id: string;
  day: string;
  messages: number;
  input_tokens: number;
  output_tokens: number;
}

export interface OrganizationAiRow {
  ai_enabled: boolean;
  ai_monthly_message_limit: number;
  ai_daily_user_message_limit: number;
}

export type AssistantTable =
  | "assistant_conversations"
  | "assistant_messages"
  | "assistant_tool_calls"
  | "assistant_usage"
  | "organizations";

interface UntypedSupabase {
  from(table: AssistantTable): any;
  rpc(fn: string, args: Record<string, number>): Promise<{ error: unknown }>;
}

/** Clientul sesiunii curente, pentru tabelele care inca nu sunt in tipurile generate. */
export async function assistantDb(): Promise<UntypedSupabase> {
  const supabase = await createClient();
  return supabase as unknown as UntypedSupabase;
}
