import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ChatProviderError,
  getChatProvider,
  MockChatProvider,
  OpenAiCompatibleProvider,
  parseUsage,
} from "./provider";

const TOOLS = [
  { name: "cauta", description: "Caută", parameters: { type: "object" } },
  { name: "cauta_in_manual", description: "Manual", parameters: { type: "object" } },
];

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("OpenAiCompatibleProvider", () => {
  it("trimite mesajele, tool-urile si citeste raspunsul", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "",
              tool_calls: [{ id: "t1", function: { name: "cauta", arguments: '{"text":"x"}' } }],
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 20 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiCompatibleProvider("https://api.exemplu.ro/v1/", "cheie", "model-x");
    const completion = await provider.complete({
      messages: [{ role: "user", content: "caută x" }],
      tools: TOOLS,
    });

    const [url, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as { body: string }).body);

    expect(url).toBe("https://api.exemplu.ro/v1/chat/completions");
    expect((init as { headers: Record<string, string> }).headers.Authorization).toBe(
      "Bearer cheie",
    );
    expect(body.model).toBe("model-x");
    expect(body.tools[0].function.name).toBe("cauta");
    expect(body.tool_choice).toBe("auto");

    expect(completion.toolCalls).toEqual([{ id: "t1", name: "cauta", arguments: '{"text":"x"}' }]);
    expect(completion.usage).toEqual({
      inputTokens: 100,
      outputTokens: 20,
      cacheHitTokens: 0,
      cacheMissTokens: 100,
      reasoningTokens: 0,
    });
    // Fara `model` in raspuns, ramane cel configurat.
    expect(completion.model).toBe("model-x");
  });

  it("pentru DeepSeek cu thinking activat, trimite `thinking` si citeste reasoning_content", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: "9.8 e mai mare.",
              reasoning_content: "9.11 < 9.8 pentru ca 11 sutimi < 80 sutimi.",
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiCompatibleProvider(
      "https://api.deepseek.com",
      "cheie",
      "deepseek-chat",
      true,
    );
    const completion = await provider.complete({
      messages: [{ role: "user", content: "9.11 sau 9.8, ce e mai mare?" }],
      tools: [],
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as { body: string }).body);
    expect(body.thinking).toEqual({ type: "enabled" });
    expect(completion.reasoningContent).toBe("9.11 < 9.8 pentru ca 11 sutimi < 80 sutimi.");
  });

  it("pentru DeepSeek, retrimite reasoning_content al mesajelor assistant anterioare", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiCompatibleProvider("https://api.deepseek.com", "cheie", "model");
    await provider.complete({
      messages: [
        { role: "user", content: "cauta beton" },
        {
          role: "assistant",
          content: "",
          toolCalls: [{ id: "t1", name: "cauta", arguments: "{}" }],
          reasoningContent: "trebuie sa caut beton",
        },
        { role: "tool", content: "{}", toolCallId: "t1" },
      ],
      tools: TOOLS,
    });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as { body: string }).body);
    expect(body.messages[1].reasoning_content).toBe("trebuie sa caut beton");
  });

  it("pentru DeepSeek, thinking mode e OPRIT implicit (un CoT per pas facea tura lenta)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiCompatibleProvider("https://api.deepseek.com", "k", "deepseek-chat");
    await provider.complete({ messages: [{ role: "user", content: "salut" }], tools: [] });

    const body = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body);
    expect(body.thinking).toBeUndefined();
  });

  it("pentru alti furnizori, NU trimite `thinking` (parametru necunoscut la DeepSeek)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = new OpenAiCompatibleProvider("https://api.mistral.ai/v1", "cheie", "model");
    await provider.complete({ messages: [{ role: "user", content: "salut" }], tools: [] });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as { body: string }).body);
    expect(body.thinking).toBeUndefined();
  });

  it("transforma erorile furnizorului in mesaj afisabil", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({ error: { message: "Rate limit depășit." } }),
      }),
    );

    const provider = new OpenAiCompatibleProvider("https://api.exemplu.ro/v1", "k", "m");

    await expect(provider.complete({ messages: [], tools: [] })).rejects.toThrow(ChatProviderError);
  });

  it("mesajul afisat e in romana; eroarea bruta a furnizorului ramane doar in `detail`", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: { message: "The reasoning_content in the thinking mode must be passed back" },
        }),
      }),
    );
    vi.stubGlobal("console", { ...console, error: vi.fn() });
    const provider = new OpenAiCompatibleProvider("https://api.deepseek.com", "k", "m", true);

    const error = await provider.complete({ messages: [], tools: [] }).catch((err) => err);

    expect(error).toBeInstanceOf(ChatProviderError);
    expect(error.message).not.toMatch(/reasoning_content/);
    expect(error.message).toMatch(/Furnizorul AI/);
    expect(error.detail).toMatch(/reasoning_content/);
  });

  it("thinking activ: un mesaj assistant cu tool_calls fara CoT primeste reasoning_content gol", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const call = { id: "t1", name: "cauta", arguments: "{}" };
    const messages = [
      { role: "user" as const, content: "x" },
      { role: "assistant" as const, content: "", toolCalls: [call] },
      { role: "tool" as const, content: "{}", toolCallId: "t1" },
    ];

    await new OpenAiCompatibleProvider("https://api.deepseek.com", "k", "m", true).complete({
      messages,
      tools: TOOLS,
    });
    await new OpenAiCompatibleProvider("https://api.deepseek.com", "k", "m").complete({
      messages,
      tools: TOOLS,
    });

    const bodyOf = (index: number) =>
      JSON.parse((fetchMock.mock.calls[index][1] as { body: string }).body);
    expect(bodyOf(0).messages[1].reasoning_content).toBe("");
    expect(bodyOf(1).messages[1]).not.toHaveProperty("reasoning_content");
  });
});

describe("parseUsage", () => {
  it("DeepSeek: cache hit / miss si tokenii de rationament", () => {
    expect(
      parseUsage({
        prompt_tokens: 10000,
        completion_tokens: 540,
        prompt_cache_hit_tokens: 7900,
        prompt_cache_miss_tokens: 2100,
        completion_tokens_details: { reasoning_tokens: 120 },
      }),
    ).toEqual({
      inputTokens: 10000,
      outputTokens: 540,
      cacheHitTokens: 7900,
      cacheMissTokens: 2100,
      reasoningTokens: 120,
    });
  });

  it("OpenAI: `prompt_tokens_details.cached_tokens`; restul e input nou", () => {
    expect(
      parseUsage({
        prompt_tokens: 1000,
        completion_tokens: 10,
        prompt_tokens_details: { cached_tokens: 600 },
      }),
    ).toMatchObject({ cacheHitTokens: 600, cacheMissTokens: 400 });
  });

  it("fara usage -> zero peste tot", () => {
    expect(parseUsage(undefined)).toEqual({
      inputTokens: 0,
      outputTokens: 0,
      cacheHitTokens: 0,
      cacheMissTokens: 0,
      reasoningTokens: 0,
    });
  });
});

it("modelul raportat de furnizor are prioritate fata de cel configurat", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ model: "deepseek-v4-pro", choices: [{ message: { content: "ok" } }] }),
    }),
  );
  const completion = await new OpenAiCompatibleProvider(
    "https://api.deepseek.com",
    "k",
    "deepseek-chat",
  ).complete({ messages: [], tools: [] });
  expect(completion.model).toBe("deepseek-v4-pro");
});

describe("MockChatProvider", () => {
  it("nu apeleaza niciun serviciu extern si explica lipsa cheii", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const completion = await new MockChatProvider().complete({
      messages: [{ role: "user", content: "salut" }],
      tools: TOOLS,
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(completion.content).toContain("furnizorul de test");
    expect(completion.toolCalls).toEqual([]);
  });

  it("recunoaste cateva intentii, ca fluxul sa fie demonstrabil fara chei", async () => {
    const provider = new MockChatProvider();

    const manual = await provider.complete({
      messages: [{ role: "user", content: "cum adaug un lot?" }],
      tools: TOOLS,
    });
    expect(manual.toolCalls[0]?.name).toBe("cauta_in_manual");

    const search = await provider.complete({
      messages: [{ role: "user", content: "caută beton" }],
      tools: TOOLS,
    });
    expect(search.toolCalls[0]?.name).toBe("cauta");
  });
});

describe("getChatProvider", () => {
  it("foloseste mock-ul fara chei si furnizorul real cu ele", () => {
    vi.stubEnv("ASSISTANT_API_URL", "");
    vi.stubEnv("ASSISTANT_API_KEY", "");
    vi.stubEnv("ASSISTANT_MODEL", "");
    expect(getChatProvider().name).toBe("mock");

    vi.stubEnv("ASSISTANT_API_URL", "https://api.mistral.ai/v1");
    vi.stubEnv("ASSISTANT_API_KEY", "k");
    vi.stubEnv("ASSISTANT_MODEL", "mistral-small-latest");
    expect(getChatProvider().name).toBe("openai-compatible");
  });

  it("activeaza thinking mode doar cu ASSISTANT_THINKING=enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "ok" } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("ASSISTANT_API_URL", "https://api.deepseek.com");
    vi.stubEnv("ASSISTANT_API_KEY", "k");
    vi.stubEnv("ASSISTANT_MODEL", "deepseek-chat");
    const bodyOf = (index: number) =>
      JSON.parse((fetchMock.mock.calls[index][1] as { body: string }).body);

    vi.stubEnv("ASSISTANT_THINKING", "");
    await getChatProvider().complete({ messages: [], tools: [] });
    expect(bodyOf(0).thinking).toBeUndefined();

    vi.stubEnv("ASSISTANT_THINKING", "enabled");
    await getChatProvider().complete({ messages: [], tools: [] });
    expect(bodyOf(1).thinking).toEqual({ type: "enabled" });
  });
});
