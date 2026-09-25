import type { UserRole } from "@/features/auth/session";
import type { CardPresentation } from "./tools/presentation-types";

/**
 * Statusul unei propuneri de actiune. Tool-urile de citire se salveaza direct `confirmed`.
 * `executing` e tranzitoriu - revendicat ATOMIC de `service.ts#claimProposal` inainte de
 * `tool.execute`, ca doua confirmari concurente (dublu-click, doua file) sa nu execute
 * aceeasi actiune de doua ori (docs/plans/asistent-contract-capabilitati.md).
 */
export type ToolCallStatus = "proposed" | "executing" | "confirmed" | "rejected" | "failed";

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
  toolVersion: number;
  arguments: Record<string, unknown>;
  status: ToolCallStatus;
  result: unknown;
  error: string | null;
  /** Id-ul tool-call-ului dat de furnizorul LLM - vezi coloana `provider_call_id`. */
  providerCallId: string | null;
  /** CoT-ul modelului la propunere (thinking mode DeepSeek) - vezi coloana `reasoning_content`. */
  reasoningContent: string | null;
  createdAt: string;
}

export interface AssistantConversation {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Ce vede UI-ul dupa o tura: raspunsul modelului si, eventual, o actiune de confirmat. */
export interface AssistantTurn {
  conversationId: string;
  reply: string;
  /** Propunere de scriere care asteapta confirmarea utilizatorului. */
  pendingAction: PendingAction | null;
  quota: QuotaStatus;
  /** Creditele consumate de aceasta tura - DOAR pentru admini (decizia 3 din plan). */
  turnCredits?: number;
}

export interface PendingAction {
  toolCallId: string;
  tool: string;
  /** Versiunea contractului tool-ului la momentul propunerii - vezi `AssistantTool.version`. */
  toolVersion: number;
  /** Titlu scurt pentru cardul de confirmare ("Creează clientul ACME SRL"). */
  summary: string;
  /** Payload-ul TIPAT al cardului - vezi `tools/presentation-types.ts`. */
  presentation: CardPresentation;
}

/**
 * Consumul asistentului, in CREDITE AI (docs/plans/asistent-consum-real.md, etapa 2):
 * un credit = un cost fix intern; fiecare raspuns consuma dupa costul lui real.
 */
export interface QuotaStatus {
  /** Bugetul EFECTIV al lunii (buget + credite extra), in credite. 0 = nelimitat. */
  monthlyLimit: number;
  /** Bugetul lunar obisnuit al organizatiei (fara top-up). */
  monthlyBase: number;
  /** Credite extra acordate de super-admin doar pentru luna curenta (top-up). */
  monthlyBonus: number;
  monthlyUsed: number;
  /** Plafonul zilnic al utilizatorului, in credite (procent din bugetul lunar). 0 = fara plafon. */
  dailyLimit: number;
  dailyUsed: number;
  /** Procentul din bugetul lunar pe care il poate folosi un utilizator pe zi (0 = fara plafon). */
  dailyPercent: number;
  /** Mesajele organizatiei luna aceasta (informativ). */
  messagesThisMonth: number;
  /** Cate intrebari mai incap, la costul mediu al organizatiei; `null` = inca nu stim. */
  estimatedMessagesLeft: number | null;
  /** Peste 80% din bugetul lunar. */
  warning: boolean;
  /** Motivul pentru care e blocat, daca e blocat. */
  blockedReason: "monthly" | "daily" | "disabled" | null;
}

export interface ToolContext {
  userId: string;
  role: UserRole;
  organizationId: string | null;
  clientId: string | null;
}
