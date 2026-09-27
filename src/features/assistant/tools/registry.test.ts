import { describe, expect, it } from "vitest";
import { ASSISTANT_TOOLS, findTool, toolDefinitions, toolsForRole } from "./registry";

describe("registry de tool-uri", () => {
  it("clientul nu primeste niciun tool de scriere", () => {
    const clientTools = toolsForRole("client");

    expect(clientTools.length).toBeGreaterThan(0);
    expect(clientTools.every((tool) => tool.kind === "read")).toBe(true);
    expect(clientTools.map((tool) => tool.name)).not.toContain("creeaza_client");
  });

  it("staff-ul primeste si tool-urile de scriere", () => {
    const names = toolsForRole("operator").map((tool) => tool.name);

    expect(names).toContain("creeaza_client");
    expect(names).toContain("creeaza_comanda");
    expect(names).toContain("stoc_disponibil");
    expect(names).toContain("planifica_livrare");
    expect(names).toContain("context_livrare");
    expect(names).toContain("itemi_aport");
  });

  it("staff-ul primeste actiunile pe comenzi, catalog, retete si productie", () => {
    const names = toolsForRole("operator").map((tool) => tool.name);
    for (const name of [
      "listeaza_comenzi",
      "reteta_produs",
      "accepta_comanda",
      "anuleaza_comanda",
      "sterge_ciorna",
      "anuleaza_livrare",
      "editeaza_client",
      "creeaza_item",
      "editeaza_item",
      "arhiveaza",
      "creeaza_reteta",
      "porneste_productie",
      "seteaza_imagine_produs",
      "citeste_document",
      "importa_retete",
    ]) {
      expect(names, name).toContain(name);
    }
  });

  it("super-adminul (fara organizatie) nu primeste tool-urile de scriere noi", () => {
    const writes = toolsForRole("super_admin").filter((tool) => tool.kind === "write");
    expect(writes).toEqual([]);
  });

  it("clientul nu vede tool-urile de organizatie (aport, livrari)", () => {
    const names = toolsForRole("client").map((tool) => tool.name);

    expect(names).not.toContain("itemi_aport");
    expect(names).not.toContain("context_livrare");
    expect(names).not.toContain("planifica_livrare");
    expect(names).not.toContain("listeaza_comenzi");
    expect(names).not.toContain("reteta_produs");
  });

  it("findTool respecta rolul, nu doar numele", () => {
    expect(findTool("creeaza_client", "admin")?.name).toBe("creeaza_client");
    expect(findTool("creeaza_client", "client")).toBeNull();
    expect(findTool("tool_inexistent", "admin")).toBeNull();
  });

  it("fiecare tool are nume unic, schema de obiect stricta si o versiune", () => {
    const names = ASSISTANT_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);

    for (const tool of ASSISTANT_TOOLS) {
      expect(tool.parameters.type, tool.name).toBe("object");
      expect(tool.parameters.additionalProperties, tool.name).toBe(false);
      expect(tool.description.length, tool.name).toBeGreaterThan(20);
      expect(typeof tool.version, tool.name).toBe("number");
      // AGENTS.md §2.4: orice tool de SCRIERE declara explicit un rander pt.
      // cardul de confirmare - nu poate fi uitat "generic implicit prin omisiune".
      if (tool.kind === "write") {
        expect(typeof tool.summary, tool.name).toBe("function");
        expect(typeof tool.presentation, tool.name).toBe("function");
        // Mesajul de dupa executie, la timpul trecut („Am adăugat...”) - nu „Gata: Creează...”.
        expect(typeof tool.resultSummary, tool.name).toBe("function");
      }
    }
  });

  it("definitiile trimise modelului nu contin cod", () => {
    const definitions = toolDefinitions("admin");
    expect(definitions.length).toBe(toolsForRole("admin").length);
    for (const definition of definitions) {
      expect(Object.keys(definition).sort()).toEqual(["description", "name", "parameters"]);
    }
  });
});
