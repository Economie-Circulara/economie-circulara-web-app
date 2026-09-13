import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ChatProviderError,
  getChatProvider,
  MockChatProvider,
  OpenAiCompatibleProvider,
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
    expect(completion.usage).toEqual({ inputTokens: 100, outputTokens: 20 });
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
});
