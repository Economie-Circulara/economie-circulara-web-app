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
import { compactFacts, formatFacts, historyToMessages, type ToolFact } from "./facts";
import { serializeToolResult } from "./tool-result";
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
 * Cate runde de model acceptam intr-o tura (citire -> citire -> raspuns). Fiecare runda
 * = UN apel de tool (fara apeluri paralele), deci o comanda cu client + 3 produse +
 * verificare de stoc are nevoie usor de 6-7 runde; la 5 utilizatorul primea des
 * „împarte cererea în pași” (docs/plans/asistent-performanta-quick-wins.md).
 */
export const MAX_STEPS = 12;

/** Instructiunea pentru ultimul apel, fara tool-uri, cand s-au terminat rundele. */
const OUT_OF_STEPS_PROMPT =
  "Ai atins numărul maxim de pași pentru această cerere. NU mai apela tool-uri. " +
  "Spune-i utilizatorului pe scurt ce ai aflat până acum (cu datele concrete găsite) " +
  "și ce îți mai lipsește ca să termini - o întrebare concretă, nu o scuză generică.";

const OUT_OF_STEPS_FALLBACK =
  "Nu am reușit să duc cererea la capăt în pașii disponibili. Reformulează-o sau împarte-o în pași mai mici.";

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
  return { role: "tool", toolCallId, content: serializeToolResult(payload) };
}

function assistantCallMessage(calls: ProviderToolCall[], reasoningContent?: string): ChatMessage {
  return { role: "assistant", content: "", toolCalls: calls, reasoningContent };
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
    ...historyToMessages(history),
  ];

  const outcome = await converse({ id, ctx, provider, messages });

  await saveFacts(id, outcome.facts);
  await appendMessage({ conversationId: id, role: "assistant", content: outcome.reply });

  return {
    conversationId: id,
    reply: outcome.reply,
    pendingAction: outcome.pendingAction,
    quota: await getQuotaStatus(ctx),
  };
}

interface ConverseOutcome {
  reply: string;
  pendingAction: PendingAction | null;
  /** Ce s-a gasit prin tool-urile de citire - salvat intre ture (`facts.ts`). */
  facts: ToolFact[];
  /** Furnizorul AI a raspuns cu eroare - `reply` e mesajul afisabil al erorii. */
  providerFailed?: boolean;
}

/**
 * Modelele (DeepSeek in special) incheie uneori runda ANUNTAND o actiune
 * („Propun mai întâi crearea clientului:”) fara sa apeleze tool-ul - utilizatorul
 * trebuia sa scrie inca un mesaj ca sa apara cardul. Recunoastem anuntul (text care
 * se termina in „:” sau care spune ca propune/pregateste ceva, fara sa intrebe) si
 * cerem o singura data, in aceeasi tura, apelul efectiv.
 */
export function looksLikeAnnouncedAction(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.includes("?")) return false;
  if (trimmed.endsWith(":")) return true;
  return /\b(propun|pregătesc|pregatesc|voi propune|voi crea|creez acum)\b/i.test(
    trimmed.slice(-200),
  );
}

const ANNOUNCED_ACTION_NUDGE =
  "Ai anunțat o acțiune, dar nu ai apelat tool-ul. Apelează-l acum, în acest răspuns " +
  "(utilizatorul o confirmă pe card). Dacă îți lipsește o informație, întreab-o direct.";

/**
 * Bucla model <-> tool-uri, pana la un raspuns final sau la o propunere de scriere.
 *
 * Tool-urile de CITIRE pot veni mai multe intr-o runda (ex. toate produsele unei comenzi
 * cautate deodata) si se executa toate - o runda per tool umplea rapid `MAX_STEPS`. O
 * runda care contine o SCRIERE produce o singura propunere (prima scriere); restul
 * apelurilor din runda se ignora - regula „o actiune o data” ramane neschimbata.
 */
async function converse(input: {
  id: string;
  ctx: ToolContext;
  provider: ChatProvider;
  messages: ChatMessage[];
}): Promise<ConverseOutcome> {
  const { id, ctx, provider } = input;
  const messages = [...input.messages];
  const facts: ToolFact[] = [];
  let nudged = false;
  /** Textul anuntului (daca a fost nevoie de impuls) - pastrat in raspunsul final. */
  let announced: string | null = null;
  const withAnnouncement = (reply: string) =>
    announced && !reply.includes(announced) ? `${announced}\n\n${reply}` : reply;

  for (let step = 0; step < MAX_STEPS; step++) {
    let completion;
    try {
      completion = await provider.complete({ messages, tools: toolDefinitions(ctx.role) });
    } catch (err) {
      if (err instanceof ChatProviderError) {
        return { reply: err.message, pendingAction: null, facts, providerFailed: true };
      }
      throw err;
    }

    await trackUsage({
      messages: 0,
      inputTokens: completion.usage.inputTokens,
      outputTokens: completion.usage.outputTokens,
    });

    const calls = completion.toolCalls;
    if (calls.length === 0) {
      if (!nudged && looksLikeAnnouncedAction(completion.content)) {
        nudged = true;
        announced = completion.content.trim();
        messages.push({
          role: "assistant",
          content: completion.content,
          reasoningContent: completion.reasoningContent,
        });
        messages.push({ role: "user", content: ANNOUNCED_ACTION_NUDGE });
        continue;
      }
      return {
        reply: withAnnouncement(completion.content.trim() || "Nu am un răspuns pentru asta."),
        pendingAction: null,
        facts,
      };
    }

    const writeCall = calls.find((call) => findTool(call.name, ctx.role)?.kind === "write");
    if (writeCall) {
      const tool = findTool(writeCall.name, ctx.role)!;
      const rawArgs = toolArguments(writeCall);
      let parsed: never;
      try {
        parsed = tool.parse(rawArgs) as never;
      } catch (err) {
        const reason =
          err instanceof InvalidToolArgumentsError ? err.message : "Argumente invalide.";
        messages.push(assistantCallMessage([writeCall], completion.reasoningContent));
        messages.push(toolResultMessage(writeCall.id, { eroare: reason }));
        continue;
      }

      const toolCallId = await saveProposal({
        conversationId: id,
        tool: tool.name,
        toolVersion: tool.version,
        arguments: rawArgs,
        providerCallId: writeCall.id,
        reasoningContent: completion.reasoningContent,
      });
      return {
        reply: withAnnouncement(
          completion.content.trim() ||
            "Am pregătit acțiunea de mai jos. Verific-o și confirm-o ca să o execut.",
        ),
        pendingAction: await pendingActionFrom(tool, parsed, toolCallId, ctx),
        facts,
      };
    }

    messages.push(assistantCallMessage(calls, completion.reasoningContent));
    const results = await Promise.all(calls.map((call) => executeReadCall(id, call, ctx)));
    for (const [index, call] of calls.entries()) {
      const result = results[index];
      messages.push(toolResultMessage(call.id, result.payload));
      if (result.ok) facts.push({ tool: call.name, records: compactFacts(result.payload) });
    }
  }

  return { reply: await summarizeOutOfSteps(provider, messages), pendingAction: null, facts };
}

/** Executa un apel de CITIRE; erorile devin rezultat pentru model, nu exceptii. */
async function executeReadCall(
  conversationId: string,
  call: ProviderToolCall,
  ctx: ToolContext,
): Promise<{ ok: boolean; payload: unknown }> {
  const tool = findTool(call.name, ctx.role);
  if (!tool)
    return { ok: false, payload: { eroare: `Tool necunoscut sau nepermis: ${call.name}.` } };

  const rawArgs = toolArguments(call);
  let parsed: never;
  try {
    parsed = tool.parse(rawArgs) as never;
  } catch (err) {
    const reason = err instanceof InvalidToolArgumentsError ? err.message : "Argumente invalide.";
    return { ok: false, payload: { eroare: reason } };
  }

  try {
    const result = await tool.execute(parsed, ctx);
    await logReadCall({
      conversationId,
      tool: tool.name,
      toolVersion: tool.version,
      arguments: rawArgs,
      ok: true,
    });
    return { ok: true, payload: result };
  } catch (err) {
    const reason = err instanceof Error ? err.message : "Eroare la execuția tool-ului.";
    await logReadCall({
      conversationId,
      tool: tool.name,
      toolVersion: tool.version,
      arguments: rawArgs,
      ok: false,
      error: reason,
    });
    return { ok: false, payload: { eroare: reason } };
  }
}

/** Salveaza datele de referinta ale turei (mesaj `tool`, ascuns in UI), daca exista. */
async function saveFacts(conversationId: string, facts: ToolFact[]) {
  const content = formatFacts(facts);
  if (content) await appendMessage({ conversationId, role: "tool", content });
}

/**
 * Rundele s-au terminat: in loc de un mesaj generic (care arunca tot ce a gasit
 * modelul), cerem un rezumat FARA tool-uri - utilizatorul vede ce s-a aflat si ce
 * lipseste. Daca si apelul asta esueaza, ramane mesajul generic.
 */
async function summarizeOutOfSteps(provider: ChatProvider, messages: ChatMessage[]) {
  try {
    const completion = await provider.complete({
      messages: [...messages, { role: "user", content: OUT_OF_STEPS_PROMPT }],
      tools: [],
    });
    await trackUsage({
      messages: 0,
      inputTokens: completion.usage.inputTokens,
      outputTokens: completion.usage.outputTokens,
    });
    return completion.content.trim() || OUT_OF_STEPS_FALLBACK;
  } catch {
    return OUT_OF_STEPS_FALLBACK;
  }
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

  // Istoricul persistat se termina cu raspunsul-text al propunerii („Am pregătit
  // acțiunea...”), salvat DUPA ultimul mesaj al utilizatorului. Il scoatem si il
  // punem ca text pe mesajul assistant(tool_calls): in thinking mode DeepSeek cere
  // `reasoning_content` pe FIECARE mesaj assistant de dupa ultimul mesaj user, iar
  // raspunsul-text nu il avea -> 400 „reasoning_content ... must be passed back”.
  const previous = historyToMessages(history);
  const trailing: string[] = [];
  while (previous.length > 0 && previous[previous.length - 1].role === "assistant") {
    trailing.unshift(previous.pop()!.content);
  }

  return [
    { role: "system", content: systemPrompt(input.ctx, org?.name ?? PLATFORM_NAME) },
    ...previous,
    {
      ...assistantCallMessage([call], input.reasoningContent ?? undefined),
      content: trailing.join("\n\n"),
    },
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
  const facts: ToolFact[] = [];
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
    // Ex. `client_id`-ul clientului tocmai creat - refolosibil in turele urmatoare.
    facts.push({ tool: tool.name, records: compactFacts(result) });

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
        if (continuation.providerFailed) {
          // Actiunea S-A executat - nu amestecam eroarea furnizorului in confirmare.
          reply = `${reply}\n\nNu am putut continua automat cu pasul următor. Scrie-mi „continuă” și reiau de aici.`;
        } else if (continuation.reply.trim()) {
          reply = `${reply}\n\n${continuation.reply.trim()}`;
        }
        pendingAction = continuation.pendingAction;
        facts.push(...continuation.facts);
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

  await saveFacts(proposal.conversationId, facts);
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
