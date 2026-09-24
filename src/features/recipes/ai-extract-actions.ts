"use server";

import { requireRole, requireUser } from "@/features/auth/session";
import { listItemOptions } from "@/features/items/queries";
import {
  ChatProviderError,
  getChatProvider,
  isChatProviderConfigured,
} from "@/features/assistant/provider";
import { getQuotaStatus, quotaMessage, trackUsage } from "@/features/assistant/quota";
import type { ToolContext } from "@/features/assistant/types";
import { buildExtractionMessages } from "./ai-extract-prompt";
import { parseExtractedRecipe, RecipeExtractionError } from "./ai-extract-parse";
import { matchComponents } from "./ai-extract-match";

/**
 * Server action pentru tab-ul "Din text (AI)" (docs/plans/reteta-ai.md). Orchestreaza
 * fluxul complet: quota -> furnizor AI (ACELASI ca al asistentului, `getChatProvider`)
 * -> parsare+validare stricta a raspunsului -> potrivire cu materialele organizatiei.
 *
 * NU e un tool al asistentului (`tools/registry.ts`) - vezi decizia §2.4 documentata
 * in docs/plans/reteta-ai.md. Consuma insa ACEEASI quota (mesaje/organizatie+utilizator),
 * ca un apel AI in plus nu ocoleste limita comerciala.
 */

export interface RecipeAiDraftRow {
  name: string;
  quantity: number;
  unit: string;
  itemId: string | null;
  itemTitle: string | null;
  itemUnit: string | null;
  confidence: number;
}

export interface RecipeAiExtractionResult {
  ok: boolean;
  /** `false` daca niciun furnizor AI real nu e configurat (ASSISTANT_API_URL/KEY/MODEL). */
  providerConfigured: boolean;
  error: string | null;
  batchQuantity: number | null;
  unit: string | null;
  rows: RecipeAiDraftRow[];
}

function emptyResult(overrides: Partial<RecipeAiExtractionResult> = {}): RecipeAiExtractionResult {
  return {
    ok: false,
    providerConfigured: true,
    error: null,
    batchQuantity: null,
    unit: null,
    rows: [],
    ...overrides,
  };
}

async function currentToolContext(): Promise<ToolContext> {
  const user = await requireUser();
  return {
    userId: user.id,
    role: user.role,
    organizationId: user.organizationId,
    clientId: user.clientId,
  };
}

export async function extractRecipeFromTextAction(input: {
  itemId: string;
  text: string;
}): Promise<RecipeAiExtractionResult> {
  await requireRole(["admin", "operator"]);

  if (!isChatProviderConfigured()) {
    return emptyResult({
      providerConfigured: false,
      error:
        "Extragerea din text cu AI nu este configurată. Un administrator poate seta " +
        "ASSISTANT_API_URL, ASSISTANT_API_KEY și ASSISTANT_MODEL.",
    });
  }

  const text = input.text.trim();
  if (!text) return emptyResult({ error: "Lipește textul rețetei." });

  const ctx = await currentToolContext();
  const quota = await getQuotaStatus(ctx);
  const blockedMessage = quotaMessage(quota);
  if (blockedMessage) return emptyResult({ error: blockedMessage });

  const provider = getChatProvider();
  const messages = buildExtractionMessages(text);

  let content: string;
  try {
    const completion = await provider.complete({ messages, tools: [] });
    content = completion.content;
    // Un apel AI in plus - conteaza in aceeasi quota de mesaje ca fluxul asistentului
    // (AGENTS.md §2.4/quota.ts) - altfel functia asta ar fi un "asistent gratuit".
    await trackUsage({
      messages: 1,
      inputTokens: completion.usage.inputTokens,
      outputTokens: completion.usage.outputTokens,
    });
  } catch (err) {
    return emptyResult({
      error:
        err instanceof ChatProviderError
          ? err.message
          : "Furnizorul AI nu a putut fi contactat. Încearcă din nou sau introdu rețeta manual.",
    });
  }

  let extracted;
  try {
    extracted = parseExtractedRecipe(content);
  } catch (err) {
    return emptyResult({
      error:
        err instanceof RecipeExtractionError
          ? err.message
          : "Răspunsul AI nu a putut fi interpretat ca rețetă.",
    });
  }

  // Doar materiale fizice ale organizatiei curente (RLS pe clientul sesiunii - vezi
  // `listItemOptions`), fara itemul propriu al rețetei.
  const candidates = (await listItemOptions({ kind: "physical", excludeId: input.itemId })).map(
    (option) => ({ id: option.id, title: option.title, unit: option.unit }),
  );
  const matched = matchComponents(extracted.components, candidates);

  return {
    ok: true,
    providerConfigured: true,
    error: null,
    batchQuantity: extracted.batchQuantity,
    unit: extracted.unit,
    rows: matched.map((m) => ({
      name: m.extracted.name,
      quantity: m.extracted.quantity,
      unit: m.extracted.unit,
      itemId: m.itemId,
      itemTitle: m.itemTitle,
      itemUnit: m.itemUnit,
      confidence: m.confidence,
    })),
  };
}
