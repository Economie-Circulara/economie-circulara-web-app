import type { AssistantTool } from "./tools/types";

/**
 * Mesajul afisat dupa executia unei actiuni confirmate - determinist (nu depinde de
 * model): ce s-a intamplat, la timpul trecut, plus un link catre inregistrarea
 * creata/modificata; la esec, ce n-a mers si ce poate face utilizatorul.
 */

/** Eticheta linkului, dupa ruta inregistrarii. */
const LINK_LABELS: [prefix: string, label: string][] = [
  ["/clienti/", "Vezi clientul"],
  ["/comenzi/", "Vezi comanda"],
  ["/livrari/", "Vezi livrarea"],
  ["/itemi/", "Vezi materialul"],
  ["/abonamente/", "Vezi abonamentul"],
  ["/retete/", "Vezi rețeta"],
  ["/productie/", "Vezi procesul"],
];

export function linkLabel(href: string): string {
  return LINK_LABELS.find(([prefix]) => href.startsWith(prefix))?.[1] ?? "Deschide";
}

/** Linkul intern din rezultatul unui tool (`link`), daca exista. */
export function resultLink(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const link = (result as Record<string, unknown>).link;
  return typeof link === "string" && link.startsWith("/") ? link : null;
}

export function successMessage(tool: AssistantTool<never>, input: never, result: unknown): string {
  const text =
    tool.resultSummary?.(input, result) ?? `Gata: ${tool.summary?.(input) ?? tool.name}.`;
  const link = resultLink(result);
  return link && !text.includes(link) ? `✅ ${text} [${linkLabel(link)}](${link})` : `✅ ${text}`;
}

export function failureMessage(tool: AssistantTool<never>, input: never, reason: string): string {
  const action = tool.summary?.(input) ?? tool.name;
  return (
    `⚠️ Nu am reușit: ${action}.\n\n**Motiv:** ${reason}\n\n` +
    "Nu s-a modificat nimic. Spune-mi ce să corectez și propun din nou acțiunea."
  );
}

/** Citeste un camp text/numar dintr-un rezultat de tool (tipat `unknown`). */
export function resultField(result: unknown, key: string): string | null {
  if (!result || typeof result !== "object") return null;
  const value = (result as Record<string, unknown>)[key];
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}
