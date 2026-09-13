import type { Json } from "@/lib/database.types";
import { assistantDb, type AssistantMessageRow, type AssistantToolCallRow } from "./db";
import type { AssistantMessage, AssistantToolCall, ToolCallStatus } from "./types";

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
  arguments: Record<string, unknown>;
}): Promise<string> {
  const db = await assistantDb();
  const { data, error } = await db
    .from("assistant_tool_calls")
    .insert({
      conversation_id: input.conversationId,
      tool: input.tool,
      arguments: input.arguments as Json,
      status: "proposed",
      result: null,
      error: null,
      confirmed_by: null,
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
  arguments: Record<string, unknown>;
  ok: boolean;
  error?: string;
}): Promise<void> {
  const db = await assistantDb();
  await db.from("assistant_tool_calls").insert({
    conversation_id: input.conversationId,
    tool: input.tool,
    arguments: input.arguments as Json,
    status: input.ok ? "confirmed" : "failed",
    result: null,
    error: input.error ?? null,
    confirmed_by: null,
    resolved_at: new Date().toISOString(),
  });
}

export async function getProposal(toolCallId: string): Promise<AssistantToolCall | null> {
  const db = await assistantDb();
  const { data } = await db
    .from("assistant_tool_calls")
    .select("id, conversation_id, tool, arguments, status, result, error, created_at")
    .eq("id", toolCallId)
    .single();

  const row = data as AssistantToolCallRow | null;
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    tool: row.tool,
    arguments: (row.arguments ?? {}) as Record<string, unknown>,
    status: row.status,
    result: row.result,
    error: row.error,
    createdAt: row.created_at,
  };
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
