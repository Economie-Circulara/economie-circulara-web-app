import { describe, expect, it } from "vitest";
import { isValidCnp, maskCnp, normalizeCnp } from "./cnp";

describe("CNP (clienti persoana fizica, 0051)", () => {
  it("normalizeaza spatiile si separatorii", () => {
    expect(normalizeCnp(" 190 0101-000006 ")).toBe("1900101000006");
  });

  it("accepta CNP-uri cu cifra de control corecta (inclusiv restul 10 -> 1)", () => {
    expect(isValidCnp("1900101000006")).toBe(true);
    expect(isValidCnp("2900215123459")).toBe(true);
    expect(isValidCnp("5011231456780")).toBe(true);
    expect(isValidCnp("1850505000091")).toBe(true); // rest 10 -> cifra 1
  });

  it("refuza cifra de control gresita, lungimea gresita si data imposibila", () => {
    expect(isValidCnp("1900101000000")).toBe(false);
    expect(isValidCnp("190010100000")).toBe(false);
    expect(isValidCnp("0900101000006")).toBe(false);
    expect(isValidCnp("1901301000000")).toBe(false);
    expect(isValidCnp("abcdefghijklm")).toBe(false);
  });

  it("mascheaza CNP-ul pastrand prima cifra si ultimele 4", () => {
    expect(maskCnp("1900101000006")).toBe("1********0006");
  });
});
