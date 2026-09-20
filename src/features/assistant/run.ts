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
  claimProposal,
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
 * intoarce in UI ca un card de confirmare TIPAT (`tools/presentation-types.ts`).
 * Nimic nu se scrie fara confirmare umana, iar executia e revendicata ATOMIC
 * (`confirmAction`) - vezi docs/plans/asistent-contract-capabilitati.md.
 */

/**
 * Cate runde de model acceptam intr-o tura (citire -> citire -> raspuns). Fiecare
 * tool de CITIRE e sigur (nu scrie nimic) si primul tool de SCRIERE opreste oricum
 * bucla, pt. confirmare umana - deci un plafon mai mare afecteaza doar cost/latenta
 * la cereri complexe legitime, nu siguranta. Crescut de la 5 la 10 (catalogul de
 * tool-uri a crescut: cautare CUI, cataloage separate vanzare/aport, verificare
 * stoc, planificare livrare) - un scenariu real cu mai multe entitati (ex. cauta
 * firma -> verifica stoc -> propune comanda aport -> propune si o comanda
 * separata de vanzare) putea epuiza plafonul vechi doar din pasii de citire,
 * inainte sa ajunga la vreo propunere.
 */
const MAX_STEPS = 10;

function toolArguments(call: ProviderToolCall): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(call.arguments || "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Rezultatul unui tool, trimis inapoi modelului ca mesaj `tool`. */
function toolResultMessage(toolCallId: string, payload: unknown): ChatMessage {
  return { role: "tool", toolCallId, content: JSON.stringify(payload).slice(0, 6000) };
}

function assistantCallMessage(call: ProviderToolCall, reasoningContent?: string): ChatMessage {
  return { role: "assistant", content: "", toolCalls: [call], reasoningContent };
}

async function pendingActionFrom(
  tool: AssistantTool<never>,
  input: never,
  toolCallId: string,
  ctx: ToolContext,
): Promise<PendingAction> {
  return {
    toolCallId,
    tool: tool.name,
    toolVersion: tool.version,
    summary: tool.summary?.(input) ?? `Execută ${tool.name}`,
    presentation: (await tool.presentation?.(input, ctx)) ?? { renderer: "generic", fields: [] },
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
      messages.push(assistantCallMessage(call, completion.reasoningContent));
      messages.push(
        toolResultMessage(call.id, { eroare: `Tool necunoscut sau nepermis: ${call.name}.` }),
      );
      continue;
    }

    const rawArgs = toolArguments(call);
    let parsed: never;
    try {
      parsed = tool.parse(rawArgs) as never;
    } catch (err) {
      const reason = err instanceof InvalidToolArgumentsError ? err.message : "Argumente invalide.";
      messages.push(assistantCallMessage(call, completion.reasoningContent));
      messages.push(toolResultMessage(call.id, { eroare: reason }));
      continue;
    }

    if (tool.kind === "write") {
      const toolCallId = await saveProposal({
        conversationId: id,
        tool: tool.name,
        toolVersion: tool.version,
        arguments: rawArgs,
        providerCallId: call.id,
        reasoningContent: completion.reasoningContent,
      });
      return {
        reply:
          completion.content.trim() ||
          "Am pregătit acțiunea de mai jos. Verific-o și confirm-o ca să o execut.",
        pendingAction: await pendingActionFrom(tool, parsed, toolCallId, ctx),
      };
    }

    try {
      const result = await tool.execute(parsed, ctx);
      await logReadCall({
        conversationId: id,
        tool: tool.name,
        toolVersion: tool.version,
        arguments: rawArgs,
        ok: true,
      });
      messages.push(assistantCallMessage(call, completion.reasoningContent));
      messages.push(toolResultMessage(call.id, result));
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Eroare la execuția tool-ului.";
      await logReadCall({
        conversationId: id,
        tool: tool.name,
        toolVersion: tool.version,
        arguments: rawArgs,
        ok: false,
        error: reason,
      });
      messages.push(assistantCallMessage(call, completion.reasoningContent));
      messages.push(toolResultMessage(call.id, { eroare: reason }));
    }
  }

  return {
    reply:
      "Nu am reușit să duc cererea la capăt în pașii disponibili. Reformulează-o sau împarte-o în pași mai mici.",
    pendingAction: null,
  };
}

/**
 * Reconstruieste mesajele necesare ca sa reluam conversatia cu modelul dupa o
 * confirmare: istoricul persistat (care se opreste la raspunsul "Am pregătit
 * acțiunea...") + perechea assistant(tool_calls)/tool(result) a apelului tocmai
 * executat - NICIODATA persistata in `assistant_messages` (doar in `assistant_tool_calls`,
 * de aceea avem nevoie de `provider_call_id`, vezi migrarea 0024).
 */
async function messagesForContinuation(input: {
  conversationId: string;
  ctx: ToolContext;
  tool: string;
  toolCallId: string;
  args: Record<string, unknown>;
  result: unknown;
  /** CoT-ul original al propunerii - vezi `ChatMessage.reasoningContent`. */
  reasoningContent?: string | null;
}): Promise<ChatMessage[]> {
  const org = await getCurrentOrg();
  const history = (await listMessages(input.conversationId)).slice(-HISTORY_LIMIT);
  const call: ProviderToolCall = {
    id: input.toolCallId,
    name: input.tool,
    arguments: JSON.stringify(input.args),
  };

  return [
    { role: "system", content: systemPrompt(input.ctx, org?.name ?? PLATFORM_NAME) },
    ...history.map((entry) => ({
      role: entry.role === "tool" ? ("assistant" as const) : entry.role,
      content: entry.content,
    })),
    assistantCallMessage(call, input.reasoningContent ?? undefined),
    toolResultMessage(input.toolCallId, input.result),
  ];
}

/**
 * Executa o actiune propusa, dupa confirmarea utilizatorului. Argumentele pot fi
 * CORECTATE in UI - de aceea se re-valideaza aici, exact ca un `FormData` din browser.
 *
 * Trei garzi, in ordine:
 *  1. `tool.parse` - o eroare aici e RECUPERABILA: propunerea ramane `proposed`,
 *     ratspunsul explica ce e de corectat, cardul ramane deschis (nu se apeleaza
 *     `resolveProposal`, deci nimic nu se "consuma").
 *  2. `claimProposal` - revendicare ATOMICA `proposed -> executing`; esecul
 *     inseamna ca o alta cerere concurenta a executat deja actiunea (dublu-click,
 *     doua file) - NU executam a doua oara.
 *  3. `tool.execute` - o eroare aici e TERMINALA (regula de business incalcata,
 *     ex. CUI duplicat) - propunerea devine `failed`.
 */
export async function confirmAction(input: {
  toolCallId: string;
  ctx: ToolContext;
  overrides?: Record<string, unknown>;
  provider?: ChatProvider;
}): Promise<AssistantTurn> {
  const { ctx, provider = getChatProvider() } = input;
  const proposal = await getProposal(input.toolCallId);

  if (!proposal || proposal.status !== "proposed") {
    return {
      conversationId: proposal?.conversationId ?? "",
      reply:
        "Acțiunea nu mai este disponibilă (a fost deja confirmată, anulată sau e în execuție).",
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

  let parsed: never;
  try {
    parsed = tool.parse(args) as never;
  } catch (err) {
    // GARDA 1 - recuperabila: NU marcam propunerea `failed`. Reconstruim cardul din
    // argumentele ORIGINALE (validate deja o data la propunere), ca utilizatorul sa
    // poata incerca din nou - editarea lui gresita se pierde, dar propunerea nu.
    const reason = err instanceof InvalidToolArgumentsError ? err.message : "Argumente invalide.";
    const original = tool.parse(proposal.arguments) as never;
    return {
      conversationId: proposal.conversationId,
      reply: `Nu am putut aplica modificarea: ${reason} Corectează și confirmă din nou.`,
      pendingAction: await pendingActionFrom(tool, original, proposal.id, ctx),
      quota: await getQuotaStatus(ctx),
    };
  }

  // GARDA 2 - revendicare atomica. Vezi `service.ts#claimProposal`.
  const claimed = await claimProposal(proposal.id);
  if (!claimed) {
    return {
      conversationId: proposal.conversationId,
      reply: "Această acțiune a fost deja procesată (posibil dintr-o altă filă).",
      pendingAction: null,
      quota: await getQuotaStatus(ctx),
    };
  }

  let reply: string;
  let pendingAction: PendingAction | null = null;
  try {
    // GARDA 3 - executie efectiva.
    const result = await tool.execute(parsed, ctx);
    await resolveProposal({
      toolCallId: proposal.id,
      status: "confirmed",
      userId: ctx.userId,
      arguments: args,
      result,
    });
    reply = `Gata: ${tool.summary?.(parsed) ?? tool.name}.`;

    // Continuarea automata a obiectivului multi-pas (docs/plans/asistent-contract-capabilitati.md,
    // decizia 2): DOAR pe furnizor real. `MockChatProvider` decide dupa ULTIMUL mesaj
    // `user` (cuvinte cheie) - n-are cum sa interpreteze un rezultat de tool, deci ar
    // produce mereu introducerea generica ("Rulez pe furnizorul de test..."), o
    // regresie fata de linia determinista de mai sus.
    if (provider.name !== "mock") {
      try {
        const continuationMessages = await messagesForContinuation({
          conversationId: proposal.conversationId,
          ctx,
          tool: proposal.tool,
          toolCallId: proposal.providerCallId ?? proposal.id,
          args,
          result,
          reasoningContent: proposal.reasoningContent,
        });
        const continuation = await converse({
          id: proposal.conversationId,
          ctx,
          provider,
          messages: continuationMessages,
        });
        if (continuation.reply.trim()) reply = `${reply}\n\n${continuation.reply.trim()}`;
        pendingAction = continuation.pendingAction;
      } catch {
        // Best-effort: daca modelul nu poate fi contactat pentru continuare, utilizatorul
        // tot vede confirmarea deterministă de mai sus - nu transformam asta intr-o eroare.
      }
    }
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
    pendingAction,
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
