/**
 * „Date de referinta” pastrate intre ture.
 *
 * Istoricul trimis modelului contine doar mesajele user/assistant - rezultatele
 * tool-urilor dintr-o tura NU ajung in tura urmatoare. La „da, adaugă și 5 t de nisip”
 * modelul nu mai avea `client_id`-ul gasit adineauri si il cauta din nou (runde in
 * plus) sau il ghicea. Aici extragem din rezultate doar ce identifica o inregistrare
 * (ID-uri, denumire, UM, link) si le salvam ca mesaj `tool` (ascuns in UI), pe care
 * `historyToMessages` il lipeste la mesajul asistentului din aceeasi tura.
 */

import type { ChatMessage } from "./provider";
import type { AssistantMessage } from "./types";

/** Cheile pastrate, pe langa orice `*_id`. */
const KEPT_KEYS = new Set(["denumire", "cui", "um", "numar", "status", "tip", "link", "item"]);

/** Plafonul unui mesaj de date de referinta (context marginit = cost marginit). */
export const FACTS_MAX_CHARS = 2500;

export const FACTS_PREFIX =
  "[Date de referință obținute din tool-uri în tura asta - ID-uri reale, refolosibile]";

function compactRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([key, field]) =>
      (key.endsWith("_id") || KEPT_KEYS.has(key)) &&
      (typeof field === "string" || typeof field === "number" || typeof field === "boolean"),
  );
  return entries.some(([key]) => key.endsWith("_id")) ? Object.fromEntries(entries) : null;
}

/** Inregistrarile identificabile dintr-un rezultat de tool (lista, obiect sau lista infasurata). */
export function compactFacts(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result.flatMap((row): Record<string, unknown>[] => {
      const record = compactRecord(row);
      return record ? [record] : [];
    });
  }
  if (result && typeof result === "object") {
    const own = compactRecord(result);
    const nested = Object.values(result as Record<string, unknown>).flatMap((field) =>
      Array.isArray(field) ? compactFacts(field) : [],
    );
    return [...(own ? [own] : []), ...nested];
  }
  return [];
}

export interface ToolFact {
  tool: string;
  records: Record<string, unknown>[];
}

/** Textul mesajului `tool` salvat, sau `null` daca tura n-a produs nimic identificabil. */
export function formatFacts(facts: ToolFact[]): string | null {
  const lines = facts
    .filter((fact) => fact.records.length > 0)
    .map((fact) => `${fact.tool}: ${JSON.stringify(fact.records)}`);
  if (lines.length === 0) return null;

  let body = "";
  for (const line of lines) {
    const next = body ? `${body}\n${line}` : line;
    if (next.length > FACTS_MAX_CHARS) break;
    body = next;
  }
  return body ? `${FACTS_PREFIX}\n${body}` : null;
}

/**
 * Istoricul persistat -> mesaje pentru model. Un mesaj `tool` (date de referinta)
 * se lipeste la urmatorul mesaj `assistant`, ca sa nu trimitem doua mesaje assistant
 * consecutive (unii furnizori le refuza).
 */
export function historyToMessages(history: AssistantMessage[]): ChatMessage[] {
  const messages: ChatMessage[] = [];
  let pendingFacts: string[] = [];

  for (const entry of history) {
    if (entry.role === "tool") {
      pendingFacts.push(entry.content);
      continue;
    }
    if (entry.role === "assistant" && pendingFacts.length > 0) {
      messages.push({ role: "assistant", content: [...pendingFacts, entry.content].join("\n\n") });
      pendingFacts = [];
      continue;
    }
    messages.push({ role: entry.role, content: entry.content });
  }
  if (pendingFacts.length > 0) {
    messages.push({ role: "assistant", content: pendingFacts.join("\n\n") });
  }
  return messages;
}
