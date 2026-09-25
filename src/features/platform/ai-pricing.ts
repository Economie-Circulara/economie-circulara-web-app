/**
 * Reguli pure pentru preturile modelelor AI si consum (docs/plans/asistent-consum-real.md).
 * Preturile sunt in USD per 1 milion de tokeni; costurile se tin in micro-USD
 * (`cost_micros`, intregi) ca sa nu acumulam erori de virgula mobila.
 */

export interface ModelPrice {
  id: string;
  model: string;
  inputCacheHitPerM: number;
  inputCacheMissPerM: number;
  outputPerM: number;
  validFrom: string;
  note: string | null;
  createdAt: string;
}

export interface TokenCounts {
  inputCacheHit: number;
  inputCacheMiss: number;
  output: number;
}

/** Modelul pretului implicit (conservator) - folosit pentru modele fara pret propriu. */
export const DEFAULT_PRICE_MODEL = "*";

/** Cost in micro-USD, rotunjit in sus - aceeasi formula ca `assistant_record_usage` (0037). */
export function costMicros(
  tokens: TokenCounts,
  price: Omit<ModelPrice, "id" | "model" | "validFrom" | "note" | "createdAt">,
): number {
  return Math.ceil(
    tokens.inputCacheHit * price.inputCacheHitPerM +
      tokens.inputCacheMiss * price.inputCacheMissPerM +
      tokens.output * price.outputPerM,
  );
}

/** Formatare USD pentru afisare: sub $1 cu 4 zecimale (costurile tipice sunt de ordinul centilor). */
export function formatUsd(micros: number): string {
  const usd = micros / 1_000_000;
  const decimals = usd !== 0 && Math.abs(usd) < 1 ? 4 : 2;
  return `$${usd.toFixed(decimals)}`;
}

/** Pretul valabil ACUM pentru fiecare model (cel mai recent `valid_from <= acum`). */
export function currentPrices(prices: ModelPrice[], now = new Date()): Map<string, ModelPrice> {
  const current = new Map<string, ModelPrice>();
  for (const price of prices) {
    if (new Date(price.validFrom) > now) continue;
    const existing = current.get(price.model);
    if (!existing || new Date(price.validFrom) > new Date(existing.validFrom)) {
      current.set(price.model, price);
    }
  }
  return current;
}

export interface PriceFormInput {
  model: string;
  inputCacheHitPerM: number;
  inputCacheMissPerM: number;
  outputPerM: number;
  validFrom: string | null;
  note: string | null;
}

/** Valideaza formularul de pret nou. Intoarce mesajul de eroare (RO) sau `null`. */
export function validatePriceInput(input: PriceFormInput): string | null {
  if (!input.model || input.model.length > 100) {
    return "Numele modelului e obligatoriu (max. 100 caractere), exact ca în factura furnizorului.";
  }
  if (input.model !== DEFAULT_PRICE_MODEL && !/^[a-z0-9][a-z0-9._:/-]*$/i.test(input.model)) {
    return "Numele modelului poate conține litere, cifre și . _ : / - (ex. deepseek-v4-pro).";
  }
  for (const [label, value] of [
    ["input din cache", input.inputCacheHitPerM],
    ["input nou", input.inputCacheMissPerM],
    ["output", input.outputPerM],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1000) {
      return `Prețul pentru ${label} trebuie să fie un număr între 0 și 1000 (USD / 1M tokeni).`;
    }
  }
  if (input.validFrom && Number.isNaN(new Date(input.validFrom).getTime())) {
    return "Data de la care e valabil prețul nu e validă.";
  }
  if (input.note && input.note.length > 500) return "Nota poate avea cel mult 500 de caractere.";
  return null;
}

/** Numar din formular: accepta si virgula zecimala. */
export function parseDecimal(value: FormDataEntryValue | null): number {
  const text = String(value ?? "")
    .trim()
    .replace(",", ".");
  return text === "" ? Number.NaN : Number(text);
}
