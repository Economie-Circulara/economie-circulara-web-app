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

/** Valoarea creditului (USD) + plafonul per tura (credite). `null` = valid. */
export function validateCreditSettings(input: {
  creditUsd: number;
  turnCreditLimit: number;
}): string | null {
  if (!Number.isFinite(input.creditUsd) || input.creditUsd <= 0 || input.creditUsd > 1) {
    return "Valoarea unui credit trebuie să fie între 0 și 1 USD (ex. 0,001).";
  }
  if (Math.round(input.creditUsd * 1_000_000) < 1) {
    return "Valoarea unui credit trebuie să fie de cel puțin 0,000001 USD.";
  }
  if (
    !Number.isInteger(input.turnCreditLimit) ||
    input.turnCreditLimit < 0 ||
    input.turnCreditLimit > 100000
  ) {
    return "Plafonul per mesaj trebuie să fie un număr întreg de credite (0 = fără plafon).";
  }
  return null;
}

/** Limitele AI ale unei organizatii. `null` = valid. */
export function validateOrgAiLimits(input: {
  monthlyCredits: number;
  dailyPercent: number;
}): string | null {
  if (
    !Number.isInteger(input.monthlyCredits) ||
    input.monthlyCredits < 0 ||
    input.monthlyCredits > 100_000_000
  ) {
    return "Bugetul lunar trebuie să fie un număr întreg de credite (0 = nelimitat).";
  }
  if (!Number.isInteger(input.dailyPercent) || input.dailyPercent < 0 || input.dailyPercent > 100) {
    return "Procentul zilnic trebuie să fie un număr întreg între 0 și 100 (0 = fără plafon zilnic).";
  }
  return null;
}

export type OrgCreditState = "disabled" | "blocked" | "warning" | "ok" | "unlimited";

/** Ordinea in lista super-adminului: problemele primele. */
export const ORG_CREDIT_STATE_ORDER: Record<OrgCreditState, number> = {
  blocked: 0,
  warning: 1,
  disabled: 2,
  ok: 3,
  unlimited: 4,
};

export const ORG_CREDIT_STATE_LABELS: Record<OrgCreditState, string> = {
  blocked: "Buget epuizat",
  warning: "Peste 80%",
  disabled: "Oprit",
  ok: "OK",
  unlimited: "Nelimitat",
};

/**
 * Situatia pe luna curenta a unei organizatii - aceeasi regula ca `computeQuota` din
 * asistent: bugetul efectiv = buget + credite extra; 0 = nelimitat; avertizare de la 80%.
 */
export function orgCreditStatus(input: {
  enabled: boolean;
  monthlyBase: number;
  monthlyBonus: number;
  usedCredits: number;
}): { limit: number; percent: number | null; state: OrgCreditState } {
  const limit = input.monthlyBase > 0 ? input.monthlyBase + input.monthlyBonus : 0;
  const percent = limit > 0 ? Math.round((input.usedCredits / limit) * 100) : null;
  let state: OrgCreditState;
  if (!input.enabled) state = "disabled";
  else if (limit === 0) state = "unlimited";
  else if (input.usedCredits >= limit) state = "blocked";
  else if (input.usedCredits >= limit * 0.8) state = "warning";
  else state = "ok";
  return { limit, percent, state };
}

/** Top-up: credite intregi pozitive + motiv obligatoriu. `null` = valid. */
export function validateCreditGrant(input: {
  credits: number;
  reason: string | null;
}): string | null {
  if (!Number.isInteger(input.credits) || input.credits <= 0 || input.credits > 10_000_000) {
    return "Numărul de credite extra trebuie să fie un întreg pozitiv.";
  }
  if (!input.reason || input.reason.trim().length < 3) {
    return "Motivul e obligatoriu (ex. „cerere client, factura 12”).";
  }
  if (input.reason.length > 500) return "Motivul poate avea cel mult 500 de caractere.";
  return null;
}

const LIMIT_FIELD_LABELS: Record<string, string> = {
  ai_enabled: "asistent",
  ai_monthly_credit_limit: "buget lunar",
  ai_daily_user_credit_percent: "% pe zi",
  ai_monthly_message_limit: "limită mesaje (veche)",
  ai_daily_user_message_limit: "limită mesaje/zi (veche)",
};

function formatLimitValue(key: string, value: unknown): string {
  if (key === "ai_enabled") return value ? "activ" : "oprit";
  if (key === "ai_daily_user_credit_percent") return `${value}%`;
  if (key === "ai_monthly_credit_limit") return value === 0 ? "nelimitat" : `${value} credite`;
  return String(value);
}

/** Descrierea unei intrari din jurnalul `ai_limit_changes`, pentru super-admin. */
export function describeLimitChange(change: {
  type: "limits" | "grant";
  before: Record<string, unknown> | null;
  after: Record<string, unknown>;
}): string {
  if (change.type === "grant") {
    return `+${change.after.credits} credite pentru luna aceasta - ${String(change.after.reason ?? "")}`;
  }
  const parts = Object.keys(LIMIT_FIELD_LABELS).flatMap((key) => {
    const before = change.before?.[key];
    const after = change.after[key];
    if (before === after) return [];
    return [
      `${LIMIT_FIELD_LABELS[key]}: ${formatLimitValue(key, before)} → ${formatLimitValue(key, after)}`,
    ];
  });
  return parts.length ? parts.join("; ") : "fără modificări";
}
