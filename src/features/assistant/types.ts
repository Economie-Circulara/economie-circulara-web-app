import type { UserRole } from "@/features/auth/session";

/** Statusul unei propuneri de actiune. Tool-urile de citire se salveaza direct `confirmed`. */
export type ToolCallStatus = "proposed" | "confirmed" | "rejected" | "failed";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;
  createdAt: string;
}

export interface AssistantToolCall {
  id: string;
  conversationId: string;
  tool: string;
  arguments: Record<string, unknown>;
  status: ToolCallStatus;
  result: unknown;
  error: string | null;
  createdAt: string;
}

export interface AssistantConversation {
  id: string;
  title: string | null;
  createdAt: string;
}

/** Ce vede UI-ul dupa o tura: raspunsul modelului si, eventual, o actiune de confirmat. */
export interface AssistantTurn {
  conversationId: string;
  reply: string;
  /** Propunere de scriere care asteapta confirmarea utilizatorului. */
  pendingAction: PendingAction | null;
  quota: QuotaStatus;
}

export interface PendingAction {
  toolCallId: string;
  tool: string;
  /** Titlu scurt pentru cardul de confirmare ("Creează clientul ACME SRL"). */
  summary: string;
  /** Campurile propuse, in ordinea de afisare. */
  fields: { name: string; label: string; value: string }[];
}

export interface QuotaStatus {
  /** 0 = nelimitat. */
  monthlyLimit: number;
  monthlyUsed: number;
  dailyLimit: number;
  dailyUsed: number;
  /** Motivul pentru care e blocat, daca e blocat. */
  blockedReason: "monthly" | "daily" | "disabled" | null;
}

export interface ToolContext {
  userId: string;
  role: UserRole;
  organizationId: string | null;
  clientId: string | null;
}
