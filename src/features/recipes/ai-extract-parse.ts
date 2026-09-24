import type { ExtractedComponent, ExtractedRecipe } from "./ai-extract-types";

/**
 * Parsare + validare STRICTA a raspunsului modelului (docs/plans/reteta-ai.md).
 * Raspunsul modelului e tratat ca DATE, niciodata ca instructiuni sau cod de
 * executat - aici doar verificam ca forma e cea ceruta in prompt si aruncam eroare
 * pe orice abatere (fara `zod`, la fel ca restul repo-ului - `provider.ts`).
 *
 * Limite explicite (impotriva unui raspuns "creativ" sau ostil - text foarte lung,
 * mii de componente inventate etc.):
 *  - maxim `MAX_COMPONENTS` componente;
 *  - nume/unitate maxim `MAX_TEXT_LENGTH` caractere.
 */
const MAX_COMPONENTS = 50;
const MAX_TEXT_LENGTH = 200;

export class RecipeExtractionError extends Error {}

/** Extrage primul bloc JSON dintr-un text (modelul poate imbraca raspunsul in ```json ... ```). */
function extractJsonBlock(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return raw.trim();
  return raw.slice(start, end + 1);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonEmptyString(value: unknown, maxLength = MAX_TEXT_LENGTH): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function parseComponent(entry: unknown, index: number): ExtractedComponent {
  if (!entry || typeof entry !== "object") {
    throw new RecipeExtractionError(
      `Componenta ${index + 1} din răspunsul AI nu e un obiect valid.`,
    );
  }
  const record = entry as Record<string, unknown>;
  if (!isNonEmptyString(record.name)) {
    throw new RecipeExtractionError(`Componenta ${index + 1} nu are un nume valid.`);
  }
  if (!isFiniteNumber(record.quantity) || record.quantity <= 0) {
    throw new RecipeExtractionError(`Componenta "${record.name}" nu are o cantitate validă.`);
  }
  if (!isNonEmptyString(record.unit, 20)) {
    throw new RecipeExtractionError(
      `Componenta "${record.name}" nu are o unitate de măsură validă.`,
    );
  }
  return {
    name: record.name.trim(),
    quantity: record.quantity,
    unit: record.unit.trim(),
  };
}

/**
 * Parseaza si valideaza raspunsul brut al modelului (`ChatCompletion.content`).
 * Aruncă `RecipeExtractionError` (mesaj afișabil utilizatorului) pentru orice
 * răspuns care nu respectă schema din `ai-extract-prompt.ts`.
 */
export function parseExtractedRecipe(rawContent: string): ExtractedRecipe {
  const jsonText = extractJsonBlock(rawContent);

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new RecipeExtractionError(
      "Răspunsul AI nu a putut fi interpretat ca rețetă. Încearcă să reformulezi textul sau adaugă rețeta manual.",
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new RecipeExtractionError("Răspunsul AI nu are formatul așteptat.");
  }
  const record = parsed as Record<string, unknown>;

  if (!isFiniteNumber(record.batchQuantity) || record.batchQuantity < 0) {
    throw new RecipeExtractionError("Răspunsul AI nu conține o cantitate de bază validă.");
  }
  if (typeof record.unit !== "string" || record.unit.length > 20) {
    throw new RecipeExtractionError("Răspunsul AI nu conține o unitate de măsură validă.");
  }
  if (!Array.isArray(record.components)) {
    throw new RecipeExtractionError("Răspunsul AI nu conține o listă de materii prime.");
  }
  if (record.components.length === 0) {
    throw new RecipeExtractionError(
      "Nu am găsit nicio materie primă în textul lipit. Verifică textul sau introdu rețeta manual.",
    );
  }
  if (record.components.length > MAX_COMPONENTS) {
    throw new RecipeExtractionError(`Prea multe materii prime găsite (peste ${MAX_COMPONENTS}).`);
  }

  const components = record.components.map((entry, index) => parseComponent(entry, index));

  return {
    batchQuantity: record.batchQuantity,
    unit: record.unit.trim(),
    components,
  };
}
