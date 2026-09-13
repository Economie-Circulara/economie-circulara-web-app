import type { UserRole } from "@/features/auth/session";
import type { ToolContext } from "../types";

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
  /** Valideaza si normalizeaza argumentele modelului. Arunca `InvalidToolArgumentsError`. */
  parse(args: unknown): TInput;
  /** Titlul cardului de confirmare (doar pentru `write`). */
  summary?(input: TInput): string;
  /** Campurile afisate in cardul de confirmare (doar pentru `write`). */
  fields?(input: TInput): { name: string; label: string; value: string }[];
  execute(input: TInput, ctx: ToolContext): Promise<unknown>;
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
