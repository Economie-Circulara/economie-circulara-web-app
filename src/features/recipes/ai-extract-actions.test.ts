import { afterEach, describe, expect, it, vi } from "vitest";

const { requireRole, requireUser } = vi.hoisted(() => ({
  requireRole: vi.fn(),
  requireUser: vi.fn(),
}));
vi.mock("@/features/auth/session", () => ({ requireRole, requireUser }));

const { listItemOptions } = vi.hoisted(() => ({ listItemOptions: vi.fn() }));
vi.mock("@/features/items/queries", () => ({ listItemOptions }));

const { getChatProvider, isChatProviderConfigured, ChatProviderError } = vi.hoisted(() => {
  class ChatProviderErrorImpl extends Error {}
  return {
    getChatProvider: vi.fn(),
    isChatProviderConfigured: vi.fn(),
    ChatProviderError: ChatProviderErrorImpl,
  };
});
vi.mock("@/features/assistant/provider", () => ({
  getChatProvider,
  isChatProviderConfigured,
  ChatProviderError,
}));

const { getQuotaStatus, quotaMessage, recordUsage } = vi.hoisted(() => ({
  getQuotaStatus: vi.fn(),
  quotaMessage: vi.fn(),
  recordUsage: vi.fn(),
}));
vi.mock("@/features/assistant/quota", () => ({ getQuotaStatus, quotaMessage, recordUsage }));

import { extractRecipeFromTextAction } from "./ai-extract-actions";

const USER = { id: "u1", role: "admin", organizationId: "org-1", clientId: null };
const QUOTA = {
  monthlyLimit: 200,
  monthlyUsed: 1,
  dailyLimit: 20,
  dailyUsed: 1,
  dailyPercent: 20,
  messagesThisMonth: 3,
  estimatedMessagesLeft: null,
  warning: false,
  blockedReason: null,
};

const VALID_RESPONSE = JSON.stringify({
  batchQuantity: 1000,
  unit: "kg",
  components: [
    { name: "Ciment", quantity: 150, unit: "kg" },
    { name: "Necunoscut de tot", quantity: 50, unit: "kg" },
  ],
});

afterEach(() => {
  vi.clearAllMocks();
});

function setupHappyPath() {
  requireRole.mockResolvedValue(USER);
  requireUser.mockResolvedValue(USER);
  isChatProviderConfigured.mockReturnValue(true);
  getQuotaStatus.mockResolvedValue(QUOTA);
  quotaMessage.mockReturnValue(null);
  recordUsage.mockResolvedValue(undefined);
  listItemOptions.mockResolvedValue([{ id: "item-ciment", title: "Ciment", unit: "kg" }]);
}

describe("extractRecipeFromTextAction", () => {
  it("arata o stare dezactivata prietenoasa cand niciun furnizor AI nu e configurat", async () => {
    requireRole.mockResolvedValue(USER);
    isChatProviderConfigured.mockReturnValue(false);

    const result = await extractRecipeFromTextAction({ itemId: "item-1", text: "ceva text" });

    expect(result.ok).toBe(false);
    expect(result.providerConfigured).toBe(false);
    expect(result.error).toMatch(/nu este configurată/i);
    expect(getChatProvider).not.toHaveBeenCalled();
  });

  it("respinge un text gol fara sa consume quota", async () => {
    requireRole.mockResolvedValue(USER);
    isChatProviderConfigured.mockReturnValue(true);

    const result = await extractRecipeFromTextAction({ itemId: "item-1", text: "   " });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/lipește textul/i);
    expect(getQuotaStatus).not.toHaveBeenCalled();
  });

  it("respecta quota - nu apeleaza furnizorul cand utilizatorul e blocat", async () => {
    requireRole.mockResolvedValue(USER);
    requireUser.mockResolvedValue(USER);
    isChatProviderConfigured.mockReturnValue(true);
    getQuotaStatus.mockResolvedValue({ ...QUOTA, blockedReason: "monthly" });
    quotaMessage.mockReturnValue("Ați folosit toate mesajele lunare.");

    const result = await extractRecipeFromTextAction({ itemId: "item-1", text: "rețeta mea" });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Ați folosit toate mesajele lunare.");
    expect(getChatProvider).not.toHaveBeenCalled();
  });

  it("extrage, valideaza, potriveste materialele si consuma quota (1 mesaj)", async () => {
    setupHappyPath();
    const complete = vi.fn().mockResolvedValue({
      content: VALID_RESPONSE,
      toolCalls: [],
      usage: { inputTokens: 42, outputTokens: 7 },
      model: "deepseek-v4-pro",
    });
    getChatProvider.mockReturnValue({ name: "test", complete });

    const result = await extractRecipeFromTextAction({
      itemId: "item-produs",
      text: "la 1000 kg beton: 150 kg ciment, 50 kg necunoscut de tot",
    });

    expect(result.ok).toBe(true);
    expect(result.batchQuantity).toBe(1000);
    expect(result.unit).toBe("kg");
    expect(result.rows).toEqual([
      {
        name: "Ciment",
        quantity: 150,
        unit: "kg",
        itemId: "item-ciment",
        itemTitle: "Ciment",
        itemUnit: "kg",
        confidence: 1,
      },
      {
        name: "Necunoscut de tot",
        quantity: 50,
        unit: "kg",
        itemId: null,
        itemTitle: null,
        itemUnit: null,
        confidence: expect.any(Number),
      },
    ]);
    expect(recordUsage).toHaveBeenCalledWith({
      feature: "recipe_extract",
      messages: 1,
      model: "deepseek-v4-pro",
      usage: { inputTokens: 42, outputTokens: 7 },
    });
    expect(listItemOptions).toHaveBeenCalledWith({ kind: "physical", excludeId: "item-produs" });
  });

  it("propaga un mesaj prietenos cand furnizorul AI raspunde cu eroare", async () => {
    setupHappyPath();
    const complete = vi.fn().mockRejectedValue(new ChatProviderError("Furnizorul a picat."));
    getChatProvider.mockReturnValue({ name: "test", complete });

    const result = await extractRecipeFromTextAction({ itemId: "item-1", text: "text oarecare" });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Furnizorul a picat.");
    expect(recordUsage).not.toHaveBeenCalled();
  });

  it("arata o eroare prietenoasa cand raspunsul AI nu poate fi interpretat ca rețetă", async () => {
    setupHappyPath();
    const complete = vi.fn().mockResolvedValue({
      content: "nu am gasit nimic in text",
      toolCalls: [],
      usage: { inputTokens: 10, outputTokens: 2 },
    });
    getChatProvider.mockReturnValue({ name: "test", complete });

    const result = await extractRecipeFromTextAction({ itemId: "item-1", text: "text oarecare" });

    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
    // Consumul de quota se intampla la primirea raspunsului (indiferent daca modelul
    // a raspuns util) - a esuat parsarea, nu apelul catre furnizor.
    expect(recordUsage).toHaveBeenCalledTimes(1);
  });
});
