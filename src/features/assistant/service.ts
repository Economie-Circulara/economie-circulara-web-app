import type { Json } from "@/lib/database.types";
import {
  assistantDb,
  type AssistantConversationRow,
  type AssistantMessageRow,
  type AssistantToolCallRow,
} from "./db";
import type {
  AssistantConversation,
  AssistantMessage,
  AssistantToolCall,
  ToolCallStatus,
} from "./types";

/** Cate mesaje din istoric trimitem modelului (context marginit = cost marginit). */
export const HISTORY_LIMIT = 20;

export async function createConversation(input: {
  userId: string;
  organizationId: string | null;
  firstMessage: string;
}): Promise<string> {
  const db = await assistantDb();
  const { data, error } = await db
    .from("assistant_conversations")
    .insert({
      user_id: input.userId,
      organization_id: input.organizationId,
      title: input.firstMessage.slice(0, 80),
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("Nu am putut porni conversația.");
  return data.id;
}

/**
 * Conversatiile utilizatorului curent, cele mai recent active primele (pentru sidebar).
 * Exclude cele sterse soft (`deleted_at` - migrarea 0035).
 */
export async function listConversations(): Promise<AssistantConversation[]> {
  const db = await assistantDb();
  const { data } = await db
    .from("assistant_conversations")
    .select("id, title, created_at, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(50);

  return (
    (data ?? []) as Pick<AssistantConversationRow, "id" | "title" | "created_at" | "updated_at">[]
  ).map((row) => ({
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

/** O conversatie sterse soft se comporta ca inexistenta pentru UI (vezi `notFound()` in
 * `assistant-page-content.tsx`) - randul/mesajele raman in baza, doar ascunse.
 */
export async function getConversation(id: string): Promise<AssistantConversation | null> {
  const db = await assistantDb();
  const { data } = await db
    .from("assistant_conversations")
    .select("id, title, created_at, updated_at")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  const row = data as Pick<
    AssistantConversationRow,
    "id" | "title" | "created_at" | "updated_at"
  > | null;
  if (!row) return null;
  return { id: row.id, title: row.title, createdAt: row.created_at, updatedAt: row.updated_at };
}

/**
 * Sterge soft o conversatie a utilizatorului curent (`deleted_at = now()`) - RLS
 * (`assistant_conversations_own`, 0020) restrictioneaza oricum UPDATE-ul la propriile
 * randuri, dar verificam explicit `user_id` aici, ca `error`-ul sa fie clar daca cineva
 * incearca sa stearga conversatia altcuiva (0 randuri afectate, nu o exceptie RLS opaca).
 */
export async function deleteConversation(id: string, userId: string): Promise<void> {
  const db = await assistantDb();
  const { data, error } = await db
    .from("assistant_conversations")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();

  if (error) throw new Error("Nu am putut șterge conversația.");
  if (!data) throw new Error("Conversația nu există sau nu îți aparține.");
}

export async function appendMessage(input: {
  conversationId: string;
  role: AssistantMessage["role"];
  content: string;
}): Promise<void> {
  const db = await assistantDb();
  const { error } = await db.from("assistant_messages").insert({
    conversation_id: input.conversationId,
    role: input.role,
    content: input.content,
  });
  if (error) throw new Error("Nu am putut salva mesajul.");

  // Best-effort: sidebar-ul se sorteaza dupa activitate reala, nu doar dupa creare.
  // Nu aruncam daca esueaza - mesajul de mai sus s-a salvat deja cu succes.
  try {
    await db
      .from("assistant_conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", input.conversationId);
  } catch {
    // ignorat - vezi comentariul de mai sus.
  }
}

export async function listMessages(conversationId: string): Promise<AssistantMessage[]> {
  const db = await assistantDb();
  const { data } = await db
    .from("assistant_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  return ((data ?? []) as AssistantMessageRow[]).map((row) => ({
    id: row.id,
    role: row.role,
    content: row.content,
    createdAt: row.created_at,
  }));
}

export async function saveProposal(input: {
  conversationId: string;
  tool: string;
  toolVersion: number;
  arguments: Record<string, unknown>;
  /** Id-ul tool-call-ului dat de furnizorul LLM - vezi coloana `provider_call_id`. */
  providerCallId: string;
  /** CoT-ul modelului la propunere (thinking mode DeepSeek) - vezi coloana `reasoning_content`. */
  reasoningContent?: string;
}): Promise<string> {
  const db = await assistantDb();
  const { data, error } = await db
    .from("assistant_tool_calls")
    .insert({
      conversation_id: input.conversationId,
      tool: input.tool,
      tool_version: input.toolVersion,
      arguments: input.arguments as Json,
      status: "proposed",
      result: null,
      error: null,
      confirmed_by: null,
      provider_call_id: input.providerCallId,
      reasoning_content: input.reasoningContent ?? null,
      resolved_at: null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error("Nu am putut salva acțiunea propusă.");
  return data.id;
}

/** Jurnalizeaza un tool de CITIRE, executat direct (fara confirmare - n-are efecte). */
export async function logReadCall(input: {
  conversationId: string;
  tool: string;
  toolVersion: number;
  arguments: Record<string, unknown>;
  ok: boolean;
  error?: string;
}): Promise<void> {
  const db = await assistantDb();
  await db.from("assistant_tool_calls").insert({
    conversation_id: input.conversationId,
    tool: input.tool,
    tool_version: input.toolVersion,
    arguments: input.arguments as Json,
    status: input.ok ? "confirmed" : "failed",
    result: null,
    error: input.error ?? null,
    confirmed_by: null,
    provider_call_id: null,
    resolved_at: new Date().toISOString(),
  });
}

const PROPOSAL_COLUMNS =
  "id, conversation_id, tool, tool_version, arguments, status, result, error, provider_call_id, reasoning_content, created_at";

export async function getProposal(toolCallId: string): Promise<AssistantToolCall | null> {
  const db = await assistantDb();
  const { data } = await db
    .from("assistant_tool_calls")
    .select(PROPOSAL_COLUMNS)
    .eq("id", toolCallId)
    .single();

  const row = data as AssistantToolCallRow | null;
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    tool: row.tool,
    toolVersion: row.tool_version,
    arguments: (row.arguments ?? {}) as Record<string, unknown>,
    status: row.status,
    result: row.result,
    error: row.error,
    providerCallId: row.provider_call_id,
    reasoningContent: row.reasoning_content,
    createdAt: row.created_at,
  };
}

/**
 * Revendica ATOMIC executia unei propuneri: `proposed -> executing` intr-o SINGURA
 * instructiune SQL conditionata (`where status = 'proposed'`) - Postgres serializeaza
 * doua UPDATE-uri concurente pe acelasi rand (MVCC), deci a doua cerere gaseste
 * randul deja `executing` si nu afecteaza niciun rand. Intoarce `false` cand
 * revendicarea a esuat (deja revendicata/rezolvata de o alta cerere) - apelantul
 * (`run.ts#confirmAction`) NU trebuie sa mai execute tool-ul in acest caz.
 */
export async function claimProposal(toolCallId: string): Promise<boolean> {
  const db = await assistantDb();
  const { data, error } = await db
    .from("assistant_tool_calls")
    .update({ status: "executing" })
    .eq("id", toolCallId)
    .eq("status", "proposed")
    .select("id")
    .maybeSingle();

  if (error) throw new Error("Nu am putut revendica acțiunea pentru execuție.");
  return Boolean(data);
}

export async function resolveProposal(input: {
  toolCallId: string;
  status: ToolCallStatus;
  userId: string;
  arguments?: Record<string, unknown>;
  result?: unknown;
  error?: string;
}): Promise<void> {
  const db = await assistantDb();
  await db
    .from("assistant_tool_calls")
    .update({
      status: input.status,
      ...(input.arguments ? { arguments: input.arguments as Json } : {}),
      result: (input.result ?? null) as Json,
      error: input.error ?? null,
      confirmed_by: input.userId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", input.toolCallId);
}
