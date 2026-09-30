/**
 * CNP (cod numeric personal) - identificatorul clientilor persoana fizica (0051).
 * DB-ul verifica doar formatul (13 cifre); cifra de control o verificam aici, ca o
 * greseala de tastare sa fie prinsa inainte de salvare.
 */

/** Constanta oficiala a algoritmului de control CNP. */
const CNP_CONTROL_KEY = "279146358279";

/** Elimina spatiile si orice caracter care nu e cifra. */
export function normalizeCnp(raw: string): string {
  return raw.replace(/[^0-9]/g, "");
}

/**
 * 13 cifre, prima cifra 1-9 (sexul/secolul), luna 01-12, ziua 01-31, cifra de
 * control corecta (suma ponderata cu `279146358279`, mod 11; restul 10 -> 1).
 */
export function isValidCnp(cnp: string): boolean {
  if (!/^[1-9]\d{12}$/.test(cnp)) return false;

  const month = Number(cnp.slice(3, 5));
  const day = Number(cnp.slice(5, 7));
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(cnp[i]) * Number(CNP_CONTROL_KEY[i]);
  let control = sum % 11;
  if (control === 10) control = 1;

  return control === Number(cnp[12]);
}

/** CNP mascat pentru afisari secundare (ex. cardul asistentului): `1******0005`. */
export function maskCnp(cnp: string): string {
  if (cnp.length < 5) return "*".repeat(cnp.length);
  return `${cnp[0]}${"*".repeat(cnp.length - 5)}${cnp.slice(-4)}`;
}
