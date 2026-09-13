import { getCurrentOrg } from "@/features/auth/queries";
import { PLATFORM_NAME } from "@/lib/brand";
import {
  ChatProviderError,
  getChatProvider,
  type ChatMessage,
  type ChatProvider,
  type ProviderToolCall,
} from "./provider";
import { systemPrompt } from "./prompt";
import { getQuotaStatus, quotaMessage, trackUsage } from "./quota";
import {
  appendMessage,
  createConversation,
  getProposal,
  HISTORY_LIMIT,
  listMessages,
  logReadCall,
  resolveProposal,
  saveProposal,
} from "./service";
import { findTool, toolDefinitions } from "./tools/registry";
import { InvalidToolArgumentsError, type AssistantTool } from "./tools/types";
import type { AssistantTurn, PendingAction, ToolContext } from "./types";

/**
 * Bucla unei ture de conversatie.
 *
 * Tool-urile de CITIRE se executa imediat si rezultatul se da inapoi modelului, in
 * aceeasi tura. Primul tool de SCRIERE opreste bucla: se salveaza ca propunere si se
 * intoarce in UI ca un card de confirmare. Nimic nu se scrie fara confirmare umana.
 */

/** Cate runde de model acceptam intr-o tura (citire -> citire -> raspuns). */
const MAX_STEPS = 5;

function toolArguments(call: ProviderToolCall): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(call.arguments || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Rezultatul unui tool, trimis inapoi modelului ca mesaj `tool`. */
function toolResultMessage(call: ProviderToolCall, payload: unknown): ChatMessage {
  return {
    role: "tool",
    toolCallId: call.id,
    content: JSON.stringify(payload).slice(0, 6000),
  };
}

function assistantCallMessage(call: ProviderToolCall): ChatMessage {
  return { role: "assistant", content: "", toolCalls: [call] };
}

function pendingActionFrom(
  tool: AssistantTool<never>,
  input: never,
  toolCallId: string,
): PendingAction {
  return {
    toolCallId,
    tool: tool.name,
    summary: tool.summary?.(input) ?? `Execută ${tool.name}`,
    fields: tool.fields?.(input) ?? [],
  };
}

export interface RunInput {
  conversationId: string | null;
  message: string;
  ctx: ToolContext;
  /** Injectabil in teste; implicit furnizorul configurat prin env. */
  provider?: ChatProvider;
}

export async function runAssistantTurn({
  conversationId,
  message,
  ctx,
  provider = getChatProvider(),
}: RunInput): Promise<AssistantTurn> {
  const quota = await getQuotaStatus(ctx);
  const blocked = quotaMessage(quota);
  if (blocked) {
    // Nu atingem furnizorul si nu consumam nimic: quota e verificata INAINTE de apel.
    return { conversationId: conversationId ?? "", reply: blocked, pendingAction: null, quota };
  }

  const id =
    conversationId ??
    (await createConversation({
      userId: ctx.userId,
      organizationId: ctx.organizationId,
      firstMessage: message,
    }));

  await appendMessage({ conversationId: id, role: "user", content: message });
  await trackUsage({ messages: 1 });

  const org = await getCurrentOrg();
  const history = (await listMessages(id)).slice(-HISTORY_LIMIT);
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt(ctx, org?.name ?? PLATFORM_NAME) },
    ...history.map((entry) => ({
      role: entry.role === "tool" ? ("assistant" as const) : entry.role,
      content: entry.content,
    })),
  ];

  const outcome = await converse({ id, ctx, provider, messages });

  await appendMessage({ conversationId: id, role: "assistant", content: outcome.reply });

  return {
    conversationId: id,
    reply: outcome.reply,
    pendingAction: outcome.pendingAction,
    quota: await getQuotaStatus(ctx),
  };
}

/** Bucla model <-> tool-uri, pana la un raspuns final sau la o propunere de scriere. */
async function converse(input: {
  id: string;
  ctx: ToolContext;
  provider: ChatProvider;
  messages: ChatMessage[];
}): Promise<{ reply: string; pendingAction: PendingAction | null }> {
  const { id, ctx, provider } = input;
  const messages = [...input.messages];

  for (let step = 0; step < MAX_STEPS; step++) {
    let completion;
    try {
      completion = await provider.complete({ messages, tools: toolDefinitions(ctx.role) });
    } catch (err) {
      if (err instanceof ChatProviderError) return { reply: err.message, pendingAction: null };
      throw err;
    }

    await trackUsage({
      messages: 0,
      inputTokens: completion.usage.inputTokens,
      outputTokens: completion.usage.outputTokens,
    });

    const call = completion.toolCalls[0];
    if (!call) {
      return {
        reply: completion.content.trim() || "Nu am un răspuns pentru asta.",
        pendingAction: null,
      };
    }

    const tool = findTool(call.name, ctx.role);
    if (!tool) {
      messages.push(assistantCallMessage(call));
      messages.push(
        toolResultMessage(call, { eroare: `Tool necunoscut sau nepermis: ${call.name}.` }),
      );
      continue;
    }

    const rawArgs = toolArguments(call);
    let parsed: never;
    try {
      parsed = tool.parse(rawArgs) as never;
    } catch (err) {
      const reason = err instanceof InvalidToolArgumentsError ? err.message : "Argumente invalide.";
      messages.push(assistantCallMessage(call));
      messages.push(toolResultMessage(call, { eroare: reason }));
      continue;
    }

    if (tool.kind === "write") {
      const toolCallId = await saveProposal({
        conversationId: id,
        tool: tool.name,
        arguments: rawArgs,
      });
      return {
        reply:
          completion.content.trim() ||
          "Am pregătit acțiunea de mai jos. Verific-o și confirm-o ca să o execut.",
        pendingAction: pendingActionFrom(tool, parsed, toolCallId),
      };
    }

    try {
      const result = await tool.execute(parsed, ctx);
      await logReadCall({ conversationId: id, tool: tool.name, arguments: rawArgs, ok: true });
      messages.push(assistantCallMessage(call));
      messages.push(toolResultMessage(call, result));
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Eroare la execuția tool-ului.";
      await logReadCall({
        conversationId: id,
        tool: tool.name,
        arguments: rawArgs,
        ok: false,
        error: reason,
      });
      messages.push(assistantCallMessage(call));
      messages.push(toolResultMessage(call, { eroare: reason }));
    }
  }

  return {
    reply:
      "Nu am reușit să duc cererea la capăt în pașii disponibili. Reformulează-o sau împarte-o în pași mai mici.",
    pendingAction: null,
  };
}

/**
 * Executa o actiune propusa, dupa confirmarea utilizatorului. Argumentele pot fi
 * CORECTATE in UI - de aceea se re-valideaza aici, exact ca un `FormData` din browser.
 */
export async function confirmAction(input: {
  toolCallId: string;
  ctx: ToolContext;
  overrides?: Record<string, unknown>;
  provider?: ChatProvider;
}): Promise<AssistantTurn> {
  const { ctx } = input;
  const proposal = await getProposal(input.toolCallId);

  if (!proposal || proposal.status !== "proposed") {
    return {
      conversationId: proposal?.conversationId ?? "",
      reply: "Acțiunea nu mai este disponibilă (a fost deja confirmată sau anulată).",
      pendingAction: null,
      quota: await getQuotaStatus(ctx),
    };
  }

  const tool = findTool(proposal.tool, ctx.role);
  if (!tool) {
    await resolveProposal({
      toolCallId: proposal.id,
      status: "failed",
      userId: ctx.userId,
      error: "Tool indisponibil pentru rolul curent.",
    });
    return {
      conversationId: proposal.conversationId,
      reply: "Nu ai dreptul să execuți această acțiune.",
      pendingAction: null,
      quota: await getQuotaStatus(ctx),
    };
  }

  const args = { ...proposal.arguments, ...(input.overrides ?? {}) };

  let reply: string;
  try {
    const parsed = tool.parse(args) as never;
    const result = await tool.execute(parsed, ctx);
    await resolveProposal({
      toolCallId: proposal.id,
      status: "confirmed",
      userId: ctx.userId,
      arguments: args,
      result,
    });
    reply = `Gata: ${tool.summary?.(parsed) ?? tool.name}. Rezultat: ${JSON.stringify(result)}`;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Acțiunea a eșuat.";
    await resolveProposal({
      toolCallId: proposal.id,
      status: "failed",
      userId: ctx.userId,
      arguments: args,
      error: reason,
    });
    reply = `Acțiunea nu a putut fi executată: ${reason}`;
  }

  await appendMessage({
    conversationId: proposal.conversationId,
    role: "assistant",
    content: reply,
  });

  return {
    conversationId: proposal.conversationId,
    reply,
    pendingAction: null,
    quota: await getQuotaStatus(ctx),
  };
}

/** Anuleaza o propunere. Nimic nu se executa. */
export async function rejectAction(input: {
  toolCallId: string;
  ctx: ToolContext;
}): Promise<AssistantTurn> {
  const proposal = await getProposal(input.toolCallId);
  if (proposal && proposal.status === "proposed") {
    await resolveProposal({
      toolCallId: proposal.id,
      status: "rejected",
      userId: input.ctx.userId,
    });
    await appendMessage({
      conversationId: proposal.conversationId,
      role: "assistant",
      content: "Am anulat acțiunea. Nu s-a schimbat nimic.",
    });
  }

  return {
    conversationId: proposal?.conversationId ?? "",
    reply: "Am anulat acțiunea. Nu s-a schimbat nimic.",
    pendingAction: null,
    quota: await getQuotaStatus(input.ctx),
  };
}
