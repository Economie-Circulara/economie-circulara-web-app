// =============================================================================
// Spike S1 (research, rezolvat inline) — API public de lookup CUI Romania
// =============================================================================
// Alegere: serviciul public ANAF de verificare platitor TVA, v9 —
//   POST https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva
//   body: [{ cui: <numeric>, data: 'YYYY-MM-DD' }]
//
// De ce: gratuit, fara cheie API/autentificare, sursa oficiala (ANAF), acopera
// exact campurile cerute de formularul de client (denumire, adresa, nr. reg.
// com., inregistrare TVA). Alternative respinse: agregatoare terte (cost +
// dependenta externa suplimentara fata de o sursa oficiala gratuita), scraping
// termeneonline.ro (fragil, contra ToS).
//
// Limitari cunoscute: rate-limit ANAF (informal ~1 request/secunda per IP, max
// 500 coduri per request — noi trimitem mereu un singur CUI), disponibilitate
// variabila (mentenanta programata), fara CORS -> apelul TREBUIE facut
// server-side (server action), niciodata din browser.
//
// De aceea lookup-ul e o PRECOMPLETARE opționala, nu o dependenta obligatorie:
// interfata `CuiLookupProvider` face sursa inlocuibila (alt API sau un provider
// stub in medii fara acces la retea), iar daca API-ul nu raspunde la timp
// (timeout scurt, vezi `DEFAULT_TIMEOUT_MS`) sau raspunde cu eroare, formularul
// de client ramane complet completabil manual — lookup-ul nu blocheaza salvarea.
// =============================================================================

const ANAF_TVA_URL = "https://webservicesp.anaf.ro/api/PlatitorTvaRest/v9/tva";
const DEFAULT_TIMEOUT_MS = 5000;

/** Ponderile oficiale ale algoritmului de validare a cifrei de control CUI (RO). */
const CUI_CONTROL_WEIGHTS = [7, 5, 3, 2, 1, 7, 5, 3, 2];

/** Elimina prefixul "RO" (case-insensitive) si orice caracter care nu e cifra. */
export function normalizeCui(raw: string): string {
  const withoutPrefix = raw.trim().replace(/^ro/i, "");
  return withoutPrefix.replace(/[^0-9]/g, "");
}

/**
 * Valideaza formatul unui CUI romanesc normalizat: 2-10 cifre + cifra de control
 * corecta (algoritmul oficial ANAF). Folosita ca sa esuam rapid (fara apel de
 * retea) pe input evident gresit, inainte de a interoga ANAF.
 */
export function isValidCuiFormat(cui: string): boolean {
  if (!/^\d{2,10}$/.test(cui)) return false;

  const controlDigit = Number(cui[cui.length - 1]);
  const withoutControl = cui.slice(0, -1).padStart(9, "0");

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += Number(withoutControl[i]) * CUI_CONTROL_WEIGHTS[i];
  }
  let computed = (sum * 10) % 11;
  if (computed === 10) computed = 0;

  return computed === controlDigit;
}

export interface CuiLookupResult {
  cui: string;
  name: string | null;
  address: string | null;
  regCom: string | null;
  isVatPayer: boolean;
}

export interface CuiLookupProvider {
  lookup(cui: string): Promise<CuiLookupResult>;
}

/** Eroare generica de lookup (retea, format raspuns neasteptat, status HTTP etc.). */
export class CuiLookupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CuiLookupError";
  }
}

/** CUI-ul e valid ca format, dar ANAF nu are nicio firma inregistrata cu el. */
export class CuiNotFoundError extends CuiLookupError {
  constructor(cui: string) {
    super(`Nu am găsit nicio firmă cu CUI ${cui} în baza ANAF.`);
    this.name = "CuiNotFoundError";
  }
}

/** ANAF nu a raspuns in timp util — degradare grațioasă, formularul rămâne editabil manual. */
export class CuiLookupTimeoutError extends CuiLookupError {
  constructor() {
    super("Serviciul ANAF nu a răspuns la timp. Poți completa datele manual.");
    this.name = "CuiLookupTimeoutError";
  }
}

interface AnafDateGenerale {
  denumire?: string | null;
  adresa?: string | null;
  nrRegCom?: string | null;
}

interface AnafInregistrareScopTva {
  scpTVA?: boolean | null;
}

interface AnafFoundEntry {
  date_generale?: AnafDateGenerale;
  inregistrare_scop_Tva?: AnafInregistrareScopTva;
}

interface AnafResponse {
  found?: AnafFoundEntry[];
  notFound?: unknown[];
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Parseaza raspunsul JSON al ANAF (v9) intr-un `CuiLookupResult`. Exportata pentru teste. */
export function parseAnafResponse(payload: unknown, cui: string): CuiLookupResult {
  if (!payload || typeof payload !== "object") {
    throw new CuiLookupError("Răspuns neașteptat de la serviciul ANAF.");
  }

  const { found } = payload as AnafResponse;
  const entry = Array.isArray(found) ? found[0] : undefined;
  if (!entry) {
    throw new CuiNotFoundError(cui);
  }

  const dateGenerale = entry.date_generale ?? {};
  const scopTva = entry.inregistrare_scop_Tva ?? {};

  return {
    cui,
    name: dateGenerale.denumire ?? null,
    address: dateGenerale.adresa ?? null,
    regCom: dateGenerale.nrRegCom ?? null,
    isVatPayer: Boolean(scopTva.scpTVA),
  };
}

/** Implementarea concreta a `CuiLookupProvider` peste API-ul public ANAF. */
export class AnafCuiLookupProvider implements CuiLookupProvider {
  constructor(
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ) {}

  async lookup(rawCui: string): Promise<CuiLookupResult> {
    const cui = normalizeCui(rawCui);
    if (!isValidCuiFormat(cui)) {
      throw new CuiLookupError("CUI invalid — verifică numărul introdus.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await this.fetchImpl(ANAF_TVA_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ cui: Number(cui), data: todayIso() }]),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new CuiLookupError(`Serviciul ANAF a răspuns cu eroare (status ${response.status}).`);
      }

      const payload = await response.json();
      return parseAnafResponse(payload, cui);
    } catch (err) {
      if (err instanceof CuiLookupError) throw err;
      if (err instanceof Error && err.name === "AbortError") {
        throw new CuiLookupTimeoutError();
      }
      throw new CuiLookupError("Nu am putut contacta serviciul ANAF.");
    } finally {
      clearTimeout(timeout);
    }
  }
}

/** Instanta implicita, folosita de server actions. Injectabila in teste. */
export const defaultCuiLookupProvider: CuiLookupProvider = new AnafCuiLookupProvider();
