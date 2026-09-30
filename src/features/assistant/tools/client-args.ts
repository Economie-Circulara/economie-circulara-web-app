import { isValidCnp, normalizeCnp } from "@/features/clients/cnp";
import type { ClientType } from "@/features/clients/types";
import { InvalidToolArgumentsError, optionalString } from "./types";

/**
 * Argumente comune ale tool-urilor pe clienti (`creeaza_client`, `editeaza_client`) -
 * clienti persoana fizica, migrarea 0051.
 */

/** Tipul clientului din argumentele modelului: implicit firma (compatibil cu v1). */
export function parseClientType(raw: Record<string, unknown>): ClientType {
  const tip = optionalString(raw, "tip");
  if (tip === null || tip === "juridica") return "juridica";
  if (tip === "fizica") return "fizica";
  throw new InvalidToolArgumentsError('„tip" trebuie să fie „juridica" sau „fizica".');
}

/** CNP normalizat + validat (cifra de control) - aruncă pe CNP gresit. */
export function parseCnp(value: string): string {
  const cnp = normalizeCnp(value);
  if (!isValidCnp(cnp)) {
    throw new InvalidToolArgumentsError("CNP invalid - verifică cele 13 cifre.");
  }
  return cnp;
}
