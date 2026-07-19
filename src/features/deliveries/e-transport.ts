import { createHash } from "node:crypto";

/**
 * Adapterul RO e-Transport (ANAF) — Task X5.
 *
 * Context (docs/analiza-conformitate-anexa.md §3.1, spike S4 din
 * docs/plans/implementation-plan.md): integrarea REALA se face prin Socrate.io
 * (furnizor tert, API peste SPV/ANAF), NU direct cu SPV. La data acestui task,
 * S4 e ÎNCĂ nerezolvat — nu exista acces API/credentiale Socrate.io. Ca sa nu
 * blocheze restul infrastructurii (planificare livrare, aviz PDF), TOATA logica
 * de business e construita in spatele acestei interfete minimale; providerul
 * REAL se conecteaza mai tarziu, fara sa schimbe nimic in `service.ts`.
 *
 * Selectie provider prin env `ETRANSPORT_PROVIDER`:
 *   - "socrate" -> `SocrateETransportProvider` (stub, arunca pana la credentiale)
 *   - orice altceva (inclusiv lipsa) -> `MockETransportProvider` (implicit — cazul
 *     actual, fara credentiale S4)
 *
 * CAND VIN CREDENTIALELE S4 (Socrate.io): completeaza `SocrateETransportProvider.declare`
 * (payload exact + parsare raspuns, conform contractului Socrate.io — necunoscut
 * inca), seteaza `ETRANSPORT_PROVIDER=socrate` + `SOCRATE_API_URL`/`SOCRATE_API_KEY`
 * in `.env` productie. Pana atunci ramane implicit `mock` — declararea "reala" din
 * UI foloseste un UIT sandbox, vizibil ca atare (prefix `MOCK-UIT-`).
 */

/** Datele minime necesare pt. o declaratie e-Transport, extrase dintr-o livrare planificata. */
export interface ETransportDeclarationInput {
  deliveryId: string;
  organizationId: string;
  orderNumber: string | null;
  scheduledDate: string;
  carrierName: string;
  vehiclePlate: string;
  driverName: string;
  routeOrigin: string;
  routeDestination: string;
}

export interface ETransportDeclarationResult {
  uit: string;
}

/** Furnizorul de declarare e-Transport nu e configurat (credentiale S4 lipsa). */
export class ETransportNotConfiguredError extends Error {
  constructor(
    message = "Integrarea Socrate.io nu este configurată (credențiale S4 în așteptare).",
  ) {
    super(message);
    this.name = "ETransportNotConfiguredError";
  }
}

/** Furnizorul a raspuns cu o eroare (payload invalid, indisponibilitate API etc.). */
export class ETransportDeclarationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ETransportDeclarationError";
  }
}

/** Interfata comuna — un singur punct de contact intre `service.ts` si furnizorul real. */
export interface ETransportProvider {
  declare(input: ETransportDeclarationInput): Promise<ETransportDeclarationResult>;
}

/**
 * Provider MOCK/SANDBOX — folosit implicit cat timp lipsesc credentialele Socrate.io
 * (S4). Genereaza un UIT FALS, DETERMINIST (hash stabil al livrarii — acelasi
 * `deliveryId` produce mereu acelasi cod, util pt. teste si pt. reincercari
 * idempotente in demo) si logheaza incercarea (auditabil in consola serverului,
 * fara sa scrie nimic in DB — persistenta ramane in sarcina `service.ts`).
 * NU apeleaza nicio retea.
 */
export class MockETransportProvider implements ETransportProvider {
  async declare(input: ETransportDeclarationInput): Promise<ETransportDeclarationResult> {
    const hash = createHash("sha256")
      .update(input.deliveryId)
      .digest("hex")
      .slice(0, 10)
      .toUpperCase();
    const uit = `MOCK-UIT-${hash}`;

    console.info(
      `[e-transport:mock] declarare livrare ${input.deliveryId} (comanda ${
        input.orderNumber ?? "—"
      }, vehicul ${input.vehiclePlate}) -> UIT ${uit}`,
    );

    return { uit };
  }
}

/**
 * Stub Socrate.io — SCHELET, neconectat inca (S4 nerezolvat, vezi comentariul de
 * sus). Apelul HTTP e configurabil prin env (`SOCRATE_API_URL`/`SOCRATE_API_KEY`),
 * dar pana la primirea credentialelor arunca deliberat
 * `ETransportNotConfiguredError` — asta e testat explicit (e-transport.test.ts) ca
 * sa garantam ca nimeni nu "reactiveaza" din greseala providerul fara sa completeze
 * si implementarea reala de mai jos.
 */
export class SocrateETransportProvider implements ETransportProvider {
  constructor(
    private readonly config: { apiUrl?: string; apiKey?: string } = {
      apiUrl: process.env.SOCRATE_API_URL,
      apiKey: process.env.SOCRATE_API_KEY,
    },
  ) {}

  async declare(input: ETransportDeclarationInput): Promise<ETransportDeclarationResult> {
    if (!this.config.apiUrl || !this.config.apiKey) {
      throw new ETransportNotConfiguredError();
    }

    // TODO (S4, cand vin credentialele Socrate.io): payload-ul exact (transportator,
    // vehicul, ruta, marfa) si forma raspunsului (campul cu codul UIT) depind de
    // contractul Socrate.io, inca nevalidat. Structura de mai jos e un SCHELET —
    // request minimal, parsare defensiva a raspunsului — de ajustat dupa POC (S4).
    let response: Response;
    try {
      response = await fetch(`${this.config.apiUrl}/e-transport/declarations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          organizationId: input.organizationId,
          orderNumber: input.orderNumber,
          scheduledDate: input.scheduledDate,
          carrierName: input.carrierName,
          vehiclePlate: input.vehiclePlate,
          driverName: input.driverName,
          routeOrigin: input.routeOrigin,
          routeDestination: input.routeDestination,
        }),
      });
    } catch {
      throw new ETransportDeclarationError("Nu am putut contacta Socrate.io.");
    }

    if (!response.ok) {
      throw new ETransportDeclarationError(
        `Socrate.io a răspuns cu eroare (status ${response.status}).`,
      );
    }

    const payload = (await response.json()) as { uit?: string };
    if (!payload.uit) {
      throw new ETransportDeclarationError("Răspunsul Socrate.io nu conține codul UIT.");
    }

    return { uit: payload.uit };
  }
}

/**
 * Selecteaza providerul activ dupa `ETRANSPORT_PROVIDER` (implicit `mock`, cazul
 * actual — S4 nerezolvat). O instanta noua per apel: providerii sunt fara stare
 * proprie (config-ul Socrate se citeste din env la construire), deci nu costa
 * nimic sa nu fie cache-uiti.
 */
export function getETransportProvider(): ETransportProvider {
  const selected = (process.env.ETRANSPORT_PROVIDER ?? "mock").trim().toLowerCase();
  if (selected === "socrate") return new SocrateETransportProvider();
  return new MockETransportProvider();
}
