import { describe, expect, it } from "vitest";
import {
  failureMessage,
  linkLabel,
  resultField,
  resultLink,
  successMessage,
} from "./result-summary";
import type { AssistantTool } from "./tools/types";

function tool(overrides: Partial<AssistantTool<{ denumire: string }>> = {}) {
  return {
    name: "creeaza_client",
    description: "x",
    parameters: {},
    roles: ["admin"],
    version: 1,
    kind: "write",
    parse: (args: unknown) => args as { denumire: string },
    summary: (input: { denumire: string }) => `Creează clientul „${input.denumire}"`,
    execute: async () => null,
    ...overrides,
  } as unknown as AssistantTool<never>;
}

const input = { denumire: "ACME" } as never;

describe("successMessage", () => {
  it("textul la timpul trecut + link catre inregistrare", () => {
    const withSummary = tool({
      resultSummary: (value, result) =>
        `Am adăugat clientul **${resultField(result, "denumire") ?? value.denumire}**.`,
    });
    expect(successMessage(withSummary, input, { denumire: "ACME SRL", link: "/clienti/c1" })).toBe(
      "✅ Am adăugat clientul **ACME SRL**. [Vezi clientul](/clienti/c1)",
    );
  });

  it("fara `resultSummary` cade pe „Gata: <summary>”; fara link, fara link", () => {
    expect(successMessage(tool(), input, { sters: true })).toBe(
      '✅ Gata: Creează clientul „ACME".',
    );
  });

  it("ignora linkurile externe (doar rute interne)", () => {
    expect(resultLink({ link: "https://evil.example" })).toBeNull();
    expect(resultLink({ link: "/comenzi/o1" })).toBe("/comenzi/o1");
  });
});

describe("failureMessage", () => {
  it("spune ce n-a mers, motivul si ca nimic nu s-a modificat", () => {
    const text = failureMessage(tool(), input, "Există deja un client cu acest CUI.");
    expect(text).toContain('Nu am reușit: Creează clientul „ACME".');
    expect(text).toContain("**Motiv:** Există deja un client cu acest CUI.");
    expect(text).toContain("Nu s-a modificat nimic");
  });
});

describe("linkLabel", () => {
  it("alege eticheta dupa ruta", () => {
    expect(linkLabel("/comenzi/o1")).toBe("Vezi comanda");
    expect(linkLabel("/abonamente/i1")).toBe("Vezi abonamentul");
    expect(linkLabel("/altceva")).toBe("Deschide");
  });
});
