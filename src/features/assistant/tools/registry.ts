import type { UserRole } from "@/features/auth/session";
import type { ToolDefinition } from "../provider";
import { READ_TOOLS } from "./read-tools";
import { WRITE_TOOLS } from "./write-tools";
import type { AssistantTool } from "./types";

/**
 * Catalogul de tool-uri. E singura sursa de adevar despre ce poate face asistentul:
 * `run.ts` il foloseste pentru conversatie, iar un viitor server MCP (faza 4 din
 * `docs/plans/task-asistent-ai.md`) va expune exact acelasi catalog, alt transport.
 */
export const ASSISTANT_TOOLS: AssistantTool<never>[] = [...READ_TOOLS, ...WRITE_TOOLS];

/** Tool-urile permise rolului. Clientul nu primeste NICIUN tool de scriere. */
export function toolsForRole(role: UserRole): AssistantTool<never>[] {
  return ASSISTANT_TOOLS.filter((tool) => tool.roles.includes(role));
}

export function findTool(name: string, role: UserRole): AssistantTool<never> | null {
  return toolsForRole(role).find((tool) => tool.name === name) ?? null;
}

/** Definitiile trimise modelului (fara `execute`/`parse`). */
export function toolDefinitions(role: UserRole): ToolDefinition[] {
  return toolsForRole(role).map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
  }));
}
