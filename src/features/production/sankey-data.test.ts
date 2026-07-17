import { describe, expect, it } from "vitest";
import { buildProcessSankeyData } from "./sankey-data";
import type { ProcessLotLine } from "./types";

function line(overrides: Partial<ProcessLotLine> = {}): ProcessLotLine {
  return {
    lotId: "lot-1",
    itemId: "item-1",
    itemTitle: "Moloz beton",
    unit: "kg",
    quantity: 100,
    ...overrides,
  };
}

describe("buildProcessSankeyData", () => {
  it("mapeaza inputurile pe coloana 0 si outputurile pe coloana 2, cu nodul de proces pe coloana 1", () => {
    const data = buildProcessSankeyData({
      inputs: [line({ lotId: "lot-in", itemId: "item-in", itemTitle: "Moloz", quantity: 500 })],
      outputs: [
        line({
          lotId: "lot-out-1",
          itemId: "item-out-1",
          itemTitle: "Nisip reciclat",
          quantity: 250,
        }),
        line({ lotId: "lot-out-2", itemId: "item-out-2", itemTitle: "Pietriș", quantity: 200 }),
      ],
    });

    const inputNode = data.nodes.find((n) => n.label === "Moloz");
    expect(inputNode?.column).toBe(0);
    expect(inputNode?.value).toBe(500);

    const outputNodes = data.nodes.filter((n) => n.column === 2);
    expect(outputNodes).toHaveLength(2);
    expect(outputNodes.map((n) => n.value)).toEqual([250, 200]);

    const processNode = data.nodes.find((n) => n.column === 1);
    expect(processNode).toBeDefined();
    expect(processNode?.value).toBe(500); // max(totalIn, totalOut) = max(500, 450)
  });

  it("creeaza o legatura per lot: input -> proces si proces -> output", () => {
    const data = buildProcessSankeyData({
      inputs: [line({ lotId: "lot-in", quantity: 100 })],
      outputs: [line({ lotId: "lot-out", quantity: 90 })],
    });

    expect(data.links).toHaveLength(2);
    const [inLink, outLink] = data.links;
    expect(inLink.target).toBe("process");
    expect(inLink.value).toBe(100);
    expect(outLink.source).toBe("process");
    expect(outLink.value).toBe(90);
  });

  it("gestioneaza un proces fara loturi (nu arunca eroare)", () => {
    const data = buildProcessSankeyData({ inputs: [], outputs: [] });
    expect(data.nodes).toHaveLength(1); // doar nodul de proces
    expect(data.links).toHaveLength(0);
  });

  it("include eticheta procesului data ca parametru", () => {
    const data = buildProcessSankeyData({ inputs: [], outputs: [] }, "Reciclare moloz");
    expect(data.nodes[0].label).toBe("Reciclare moloz");
  });

  it("noduri unice cand acelasi item apare in mai multe loturi de input", () => {
    const data = buildProcessSankeyData({
      inputs: [
        line({ lotId: "lot-a", itemId: "item-1", quantity: 30 }),
        line({ lotId: "lot-b", itemId: "item-1", quantity: 20 }),
      ],
      outputs: [],
    });
    const inputNodes = data.nodes.filter((n) => n.column === 0);
    expect(inputNodes).toHaveLength(2);
    expect(new Set(inputNodes.map((n) => n.id)).size).toBe(2);
  });
});
