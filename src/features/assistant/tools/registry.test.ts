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
  });

  it("findTool respecta rolul, nu doar numele", () => {
    expect(findTool("creeaza_client", "admin")?.name).toBe("creeaza_client");
    expect(findTool("creeaza_client", "client")).toBeNull();
    expect(findTool("tool_inexistent", "admin")).toBeNull();
  });

  it("fiecare tool are nume unic si schema de obiect", () => {
    const names = ASSISTANT_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);

    for (const tool of ASSISTANT_TOOLS) {
      expect(tool.parameters.type, tool.name).toBe("object");
      expect(tool.description.length, tool.name).toBeGreaterThan(20);
      // Tool-urile de scriere trebuie sa poata randa cardul de confirmare.
      if (tool.kind === "write") {
        expect(typeof tool.summary, tool.name).toBe("function");
        expect(typeof tool.fields, tool.name).toBe("function");
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
