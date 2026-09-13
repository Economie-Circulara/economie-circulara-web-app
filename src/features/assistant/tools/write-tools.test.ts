import { describe, expect, it } from "vitest";
import { creeazaClient, creeazaComanda } from "./write-tools";
import { InvalidToolArgumentsError } from "./types";

describe("creeaza_client - validarea argumentelor propuse de model", () => {
  it("normalizeaza CUI-ul si pastreaza campurile optionale", () => {
    const input = creeazaClient.parse({
      cui: "RO 12345678",
      denumire: "  ACME SRL ",
      email: "contact@acme.ro",
      platitor_tva: true,
    });

    expect(input.cui).toBe("12345678");
    expect(input.denumire).toBe("ACME SRL");
    expect(input.email).toBe("contact@acme.ro");
    expect(input.reg_com).toBeNull();
    expect(input.platitor_tva).toBe(true);
  });

  it("refuza argumentele incomplete sau de tip gresit", () => {
    expect(() => creeazaClient.parse({ denumire: "ACME" })).toThrow(InvalidToolArgumentsError);
    expect(() => creeazaClient.parse({ cui: "123", denumire: "" })).toThrow(
      InvalidToolArgumentsError,
    );
    expect(() => creeazaClient.parse({ cui: "12345678", denumire: "ACME", email: 5 })).toThrow(
      InvalidToolArgumentsError,
    );
    expect(() => creeazaClient.parse("nu e obiect")).toThrow(InvalidToolArgumentsError);
  });

  it("produce un card de confirmare lizibil", () => {
    const input = creeazaClient.parse({ cui: "12345678", denumire: "ACME SRL" });

    expect(creeazaClient.summary?.(input)).toContain("ACME SRL");
    expect(creeazaClient.fields?.(input).map((field) => field.name)).toContain("cui");
  });
});

describe("creeaza_comanda - validarea liniilor", () => {
  it("acceapta linii corecte si data in format ISO", () => {
    const input = creeazaComanda.parse({
      client_id: "c1",
      linii: [{ item_id: "i1", cantitate: 2 }],
      data_livrare: "2026-10-01",
    });

    expect(input.linii).toEqual([{ item_id: "i1", cantitate: 2 }]);
    expect(input.data_livrare).toBe("2026-10-01");
  });

  it("refuza comanda fara linii, cantitati invalide sau data gresita", () => {
    expect(() => creeazaComanda.parse({ client_id: "c1", linii: [] })).toThrow(
      InvalidToolArgumentsError,
    );
    expect(() =>
      creeazaComanda.parse({ client_id: "c1", linii: [{ item_id: "i1", cantitate: 0 }] }),
    ).toThrow(InvalidToolArgumentsError);
    expect(() =>
      creeazaComanda.parse({
        client_id: "c1",
        linii: [{ item_id: "i1", cantitate: 1 }],
        data_livrare: "01.10.2026",
      }),
    ).toThrow(InvalidToolArgumentsError);
  });
});
