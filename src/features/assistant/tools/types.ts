import type { UserRole } from "@/features/auth/session";
import type { ToolContext } from "../types";
import type { CardPresentation } from "./presentation-types";

/** Argumente invalide venite de la model - se intorc modelului ca sa reincerce. */
export class InvalidToolArgumentsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidToolArgumentsError";
  }
}

export interface AssistantTool<TInput = Record<string, unknown>> {
  name: string;
  /** Descrierea vazuta de model - scurta si fara ambiguitati. */
  description: string;
  /** JSON Schema al argumentelor (scris de mana: repo-ul nu foloseste zod). */
  parameters: Record<string, unknown>;
  roles: UserRole[];
  /**
   * `read` se executa imediat (n-are efecte), `write` se executa DOAR dupa confirmarea
   * umana a argumentelor propuse de model.
   */
  kind: "read" | "write";
  /**
   * Versiunea contractului acestui tool (schema parametrilor + comportament) -
   * persistata pe `assistant_tool_calls.tool_version` la propunere, ca audit. Se
   * incrementeaza manual cand schema/logica se schimba intr-un mod care ar
   * schimba interpretarea unui apel vechi. Toate tool-urile pornesc de la 1
   * (AGENTS.md §2.4).
   */
  version: number;
  /** Valideaza si normalizeaza argumentele modelului. Arunca `InvalidToolArgumentsError`. */
  parse(args: unknown): TInput;
  /** Titlul cardului de confirmare (doar pentru `write`) - la imperativ („Creează clientul X”). */
  summary?(input: TInput): string;
  /**
   * Ce s-a intamplat, dupa executie, la timpul trecut („Am adăugat clientul **X**.”) -
   * primeste si rezultatul (`execute`). Linkul din `result.link` se adauga automat
   * (`result-summary.ts`). Lipsa = „Gata: <summary>.”.
   */
  resultSummary?(input: TInput, result: unknown): string;
  /**
   * Payload-ul TIPAT al cardului de confirmare (doar pentru `write`, OBLIGATORIU -
   * verificat de `tools/registry.test.ts`). Poate citi din DB (rezolva ID-uri la
   * denumiri, incarca optiuni pt. randere structurate ca `order_draft`) - de aceea
   * e async si primeste `ctx`.
   */
  presentation?(input: TInput, ctx: ToolContext): Promise<CardPresentation>;
  execute(input: TInput, ctx: ToolContext): Promise<unknown>;
  /**
   * Plafonul rezultatului trimis modelului (caractere). Implicit
   * `TOOL_RESULT_MAX_CHARS` - mai mare doar pentru tool-uri care intorc text de citit
   * (ex. `citeste_document`).
   */
  maxResultChars?: number;
}

/** Helper-e de validare - mici si explicite, ca sa nu adaugam o librarie de scheme. */
export function asObject(args: unknown): Record<string, unknown> {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new InvalidToolArgumentsError("Argumentele trebuie să fie un obiect JSON.");
  }
  return args as Record<string, unknown>;
}

export function requiredString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new InvalidToolArgumentsError(`Câmpul "${key}" este obligatoriu.`);
  }
  return value.trim();
}

export function optionalString(args: Record<string, unknown>, key: string): string | null {
  const value = args[key];
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") {
    throw new InvalidToolArgumentsError(`Câmpul "${key}" trebuie să fie text.`);
  }
  return value.trim();
}

export function optionalBoolean(args: Record<string, unknown>, key: string): boolean | null {
  const value = args[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== "boolean") {
    throw new InvalidToolArgumentsError(`Câmpul "${key}" trebuie să fie true sau false.`);
  }
  return value;
}

export function positiveNumber(args: Record<string, unknown>, key: string): number {
  const value = typeof args[key] === "string" ? Number(args[key]) : args[key];
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new InvalidToolArgumentsError(`Câmpul "${key}" trebuie să fie un număr pozitiv.`);
  }
  return value;
}
