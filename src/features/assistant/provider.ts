/**
 * Abstractie peste furnizorul de LLM, in acelasi stil ca
 * `features/notifications/provider.ts`: doua implementari, iar restul codului nu stie
 * si nu trebuie sa stie care e activa.
 *
 *  - `MockChatProvider` (implicit, fara chei): NU apeleaza niciun serviciu extern.
 *    Recunoaste cateva intentii uzuale dupa cuvinte cheie, ca fluxul complet (propunere
 *    -> confirmare -> executie) sa fie demonstrabil si testabil offline, si spune clar
 *    ca nu e configurata nicio cheie.
 *  - `OpenAiCompatibleProvider`: un singur cod pentru Mistral / Groq / OpenRouter /
 *    OpenAI / DeepSeek - toate expun `POST /chat/completions` cu `tools`. Configurare:
 *    `ASSISTANT_API_URL`, `ASSISTANT_API_KEY`, `ASSISTANT_MODEL` (vezi `.env.example`).
 *    Pentru DeepSeek (`ASSISTANT_API_URL` contine `deepseek.com`) thinking mode e
 *    OPTIONAL, prin `ASSISTANT_THINKING=enabled` - vezi comentariul din `complete()`.
 *
 * Alegerea furnizorului e o variabila de mediu, nu o decizie de arhitectura: daca
 * modelul se dovedeste slab la tool calling, se schimba `ASSISTANT_MODEL`, nu codul.
 */

export interface ProviderToolCall {
  id: string;
  name: string;
  /** Argumentele, exact cum le-a produs modelul (JSON neverificat). */
  arguments: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  /** Doar pentru `role: "assistant"` - apelurile de tool cerute de model. */
  toolCalls?: ProviderToolCall[];
  /** Doar pentru `role: "tool"` - apelul la care raspunde acest mesaj. */
  toolCallId?: string;
  /**
   * Doar pentru `role: "assistant"` - CoT-ul modelului (thinking mode). Trebuie
   * retrimis EXACT cum a fost primit pe orice mesaj `assistant` cu `toolCalls` cat timp
   * cererea are `tools`, altfel DeepSeek raspunde cu eroare 400 (vezi `OpenAiCompatibleProvider`).
   */
  reasoningContent?: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema al argumentelor (scris de mana - repo-ul nu foloseste zod). */
  parameters: Record<string, unknown>;
}

export interface ChatCompletion {
  content: string;
  toolCalls: ProviderToolCall[];
  usage: { inputTokens: number; outputTokens: number };
  /** CoT-ul modelului, daca furnizorul suporta thinking mode (ex. DeepSeek). */
  reasoningContent?: string;
}

export interface ChatProvider {
  readonly name: string;
  complete(input: { messages: ChatMessage[]; tools: ToolDefinition[] }): Promise<ChatCompletion>;
}

/**
 * Furnizorul nu e configurat sau a raspuns cu eroare. `message` e textul AFISAT
 * utilizatorului (romana, fara jargon); `detail` e eroarea bruta a furnizorului
 * (ex. „The reasoning_content in the thinking mode must be passed back...”) - doar
 * pentru log, nu ajunge in chat.
 */
export class ChatProviderError extends Error {
  constructor(
    message: string,
    readonly detail: string | null = null,
  ) {
    super(message);
    this.name = "ChatProviderError";
  }
}

/** Mesajul pentru utilizator, dupa statusul HTTP al furnizorului. */
export function providerErrorMessage(status: number): string {
  if (status === 429) {
    return "Furnizorul AI e suprasolicitat momentan. Încearcă din nou peste câteva secunde.";
  }
  if (status === 401 || status === 403) {
    return "Asistentul nu se poate conecta la furnizorul AI (cheie invalidă). Anunță administratorul.";
  }
  return "Furnizorul AI a răspuns cu o eroare. Încearcă din nou; dacă se repetă, anunță administratorul.";
}

const MOCK_INTRO =
  "Rulez pe furnizorul de test (nicio cheie API configurată), deci răspund doar la câteva " +
  "comenzi simple. Configurează `ASSISTANT_API_URL`, `ASSISTANT_API_KEY` și `ASSISTANT_MODEL` " +
  "pentru un asistent complet.";

/** Extrage un CUI dintr-un text liber ("CUI 12345678", "RO12345678"). */
function findCui(text: string): string | null {
  return /\b(?:RO\s*)?(\d{6,10})\b/i.exec(text)?.[1] ?? null;
}

export class MockChatProvider implements ChatProvider {
  readonly name = "mock";

  async complete({ messages, tools }: { messages: ChatMessage[]; tools: ToolDefinition[] }) {
    const lastUser = [...messages].reverse().find((message) => message.role === "user");
    const text = (lastUser?.content ?? "").toLowerCase();
    const available = new Set(tools.map((tool) => tool.name));
    const usage = { inputTokens: 0, outputTokens: 0 };

    const call = (name: string, args: Record<string, unknown>): ChatCompletion => ({
      content: "",
      toolCalls: [{ id: `mock-${name}-${messages.length}`, name, arguments: JSON.stringify(args) }],
      usage,
    });

    const cui = findCui(lastUser?.content ?? "");
    if (cui && available.has("cauta_firma_dupa_cui") && /caut|verific|firma|cui/.test(text)) {
      return call("cauta_firma_dupa_cui", { cui });
    }
    if (available.has("cauta_in_manual") && /(cum|unde|ce inseamna|manual|ajutor)/.test(text)) {
      return call("cauta_in_manual", { intrebare: lastUser?.content ?? "" });
    }
    if (available.has("cauta") && /(caut|gaseste|găsește)/.test(text)) {
      return call("cauta", { text: lastUser?.content ?? "" });
    }

    return { content: MOCK_INTRO, toolCalls: [], usage };
  }
}

interface OpenAiToolCall {
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface OpenAiResponse {
  choices?: {
    message?: {
      content?: string | null;
      tool_calls?: OpenAiToolCall[];
      reasoning_content?: string | null;
    };
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { message?: string };
}

export class OpenAiCompatibleProvider implements ChatProvider {
  readonly name = "openai-compatible";

  constructor(
    private readonly baseUrl: string,
    private readonly apiKey: string,
    private readonly model: string,
    /** Thinking mode (doar DeepSeek). Implicit oprit - vezi `complete()`. */
    private readonly thinking = false,
  ) {}

  async complete({
    messages,
    tools,
  }: {
    messages: ChatMessage[];
    tools: ToolDefinition[];
  }): Promise<ChatCompletion> {
    // DeepSeek e singurul furnizor din lista (Mistral/Groq/OpenRouter/OpenAI) cu thinking
    // mode: https://api-docs.deepseek.com/guides/thinking_mode/. Cand are `tools`, cere
    // *obligatoriu* `reasoning_content` inapoi pe fiecare mesaj `assistant` din cererile
    // urmatoare - altfel raspunde cu 400 - de-aia mesajele mai jos il retrimit mereu.
    // E OPTIONAL (`ASSISTANT_THINKING=enabled`): bucla face cate un apel de model per
    // tool, iar un CoT lung la fiecare cautare facea o tura sa dureze zeci de secunde
    // (docs/plans/asistent-performanta-quick-wins.md).
    const isDeepSeek = /(?:^|\.)deepseek\.com(?:\/|$)/i.test(this.baseUrl);
    const thinking = isDeepSeek && this.thinking;

    const response = await fetch(`${this.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        // Temperatura mica: vrem argumente corecte, nu creativitate. (Ignorata de
        // DeepSeek in thinking mode, dar celelalte furnizoare tot o folosesc.)
        temperature: 0.1,
        ...(thinking ? { thinking: { type: "enabled" } } : {}),
        messages: messages.map((message) => ({
          role: message.role,
          content: message.content,
          ...(message.toolCalls?.length
            ? {
                tool_calls: message.toolCalls.map((toolCall) => ({
                  id: toolCall.id,
                  type: "function",
                  function: { name: toolCall.name, arguments: toolCall.arguments },
                })),
              }
            : {}),
          ...(message.toolCallId ? { tool_call_id: message.toolCallId } : {}),
          ...(message.reasoningContent
            ? { reasoning_content: message.reasoningContent }
            : // Plasa de siguranta: in thinking mode DeepSeek respinge (400) un mesaj
              // assistant cu tool_calls fara `reasoning_content` - ex. o propunere
              // salvata cand thinking era oprit, continuata dupa ce a fost pornit.
              thinking && message.role === "assistant" && message.toolCalls?.length
              ? { reasoning_content: "" }
              : {}),
        })),
        ...(tools.length
          ? {
              tools: tools.map((tool) => ({
                type: "function",
                function: {
                  name: tool.name,
                  description: tool.description,
                  parameters: tool.parameters,
                },
              })),
              tool_choice: "auto",
              // Apelurile paralele sunt PERMISE: mai multe citiri intr-o runda (ex. toate
              // produsele unei comenzi) economisesc runde de model. Regula „o singura
              // propunere de scriere o data” e impusa in `run.ts#converse`, care ia doar
              // prima scriere dintr-o runda (docs/plans/asistent-performanta-part2.md).
            }
          : {}),
      }),
    });

    const payload = (await response.json().catch(() => null)) as OpenAiResponse | null;

    if (!response.ok || !payload) {
      const detail = payload?.error?.message ?? `HTTP ${response.status}`;
      console.error(`[asistent] eroare furnizor AI (${response.status}): ${detail}`);
      throw new ChatProviderError(providerErrorMessage(response.status), detail);
    }

    const message = payload.choices?.[0]?.message;
    return {
      content: message?.content ?? "",
      toolCalls: (message?.tool_calls ?? []).flatMap((toolCall) =>
        toolCall.function?.name
          ? [
              {
                id: toolCall.id ?? toolCall.function.name,
                name: toolCall.function.name,
                arguments: toolCall.function.arguments ?? "{}",
              },
            ]
          : [],
      ),
      usage: {
        inputTokens: payload.usage?.prompt_tokens ?? 0,
        outputTokens: payload.usage?.completion_tokens ?? 0,
      },
      ...(message?.reasoning_content ? { reasoningContent: message.reasoning_content } : {}),
    };
  }
}

/** Furnizorul activ: cel real daca sunt configurate cheile, altfel mock-ul. */
export function getChatProvider(): ChatProvider {
  const url = process.env.ASSISTANT_API_URL;
  const key = process.env.ASSISTANT_API_KEY;
  const model = process.env.ASSISTANT_MODEL;

  if (url && key && model) {
    const thinking = process.env.ASSISTANT_THINKING === "enabled";
    return new OpenAiCompatibleProvider(url, key, model, thinking);
  }
  return new MockChatProvider();
}

/** Adevarat daca asistentul e legat la un furnizor real (folosit pentru mesajele din UI). */
export function isChatProviderConfigured(): boolean {
  return Boolean(
    process.env.ASSISTANT_API_URL && process.env.ASSISTANT_API_KEY && process.env.ASSISTANT_MODEL,
  );
}
