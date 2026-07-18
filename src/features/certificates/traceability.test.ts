import { describe, expect, it } from "vitest";
import { buildTraceabilityGraph } from "./traceability";
import type { TraceabilityRawData } from "./types";

/**
 * Scenariul din mockup (docs/design/Lateris_Trace.dc.html — ecranul Certificat):
 * un singur proces de fabricatie consuma argila reciclata + ciment achizitionat +
 * apa, produce caramida eco, livrata integral pe comanda.
 */
function mockupScenario(): TraceabilityRawData {
  return {
    delivered: [
      {
        lotId: "lot-brick",
        itemId: "item-brick",
        itemTitle: "Cărămidă eco",
        unit: "buc",
        quantity: 4000,
      },
    ],
    lots: {
      "lot-clay": {
        id: "lot-clay",
        itemId: "item-clay",
        itemTitle: "Argilă reciclată",
        unit: "kg",
        provenance: "recycling",
        source: "Ceramheld SRL",
        entryDate: "2026-06-01",
      },
      "lot-cement": {
        id: "lot-cement",
        itemId: "item-cement",
        itemTitle: "Ciment Portland",
        unit: "kg",
        provenance: "purchase",
        source: "Carmeuse RO",
        entryDate: "2026-06-01",
      },
      "lot-water": {
        id: "lot-water",
        itemId: "item-water",
        itemTitle: "Apă tehnologică",
        unit: "litru",
        provenance: "purchase",
        source: null,
        entryDate: "2026-06-01",
      },
      "lot-brick": {
        id: "lot-brick",
        itemId: "item-brick",
        itemTitle: "Cărămidă eco",
        unit: "buc",
        provenance: "internal_production",
        source: null,
        entryDate: "2026-06-24",
      },
    },
    processes: {
      "proc-fabricatie": { id: "proc-fabricatie", type: "output_fixed", completedAt: "2026-06-24" },
    },
    outputByLot: {
      "lot-brick": { processId: "proc-fabricatie", lotId: "lot-brick", quantity: 4000 },
    },
    inputsByProcess: {
      "proc-fabricatie": [
        { processId: "proc-fabricatie", lotId: "lot-clay", quantity: 3000 },
        { processId: "proc-fabricatie", lotId: "lot-cement", quantity: 570 },
        { processId: "proc-fabricatie", lotId: "lot-water", quantity: 430 },
      ],
    },
  };
}

describe("buildTraceabilityGraph", () => {
  it("intoarce graf gol pentru o comanda fara loturi livrate", () => {
    const result = buildTraceabilityGraph({
      delivered: [],
      lots: {},
      processes: {},
      outputByLot: {},
      inputsByProcess: {},
    });
    expect(result.graph.nodes).toHaveLength(0);
    expect(result.materials).toHaveLength(0);
  });

  it("construieste lantul complet surse -> loturi -> proces -> lot produs -> livrare", () => {
    const { graph } = buildTraceabilityGraph(mockupScenario());

    const sourceNodes = graph.nodes.filter((n) => n.kind === "source");
    const lotNodes = graph.nodes.filter((n) => n.kind === "lot");
    const processNodes = graph.nodes.filter((n) => n.kind === "process");
    const deliveryNodes = graph.nodes.filter((n) => n.kind === "delivery");

    expect(sourceNodes).toHaveLength(3); // argila, ciment, apa
    expect(lotNodes).toHaveLength(4); // 3 materii prime + 1 lot produs
    expect(processNodes).toHaveLength(1);
    expect(deliveryNodes).toHaveLength(1);
    expect(deliveryNodes[0].label).toBe("Cărămidă eco");
    expect(deliveryNodes[0].value).toBe(4000);

    // coloane cresc monoton pe lant: sursa(0) -> lot materie prima(1) -> proces(2) -> lot produs(3) -> livrare(4)
    expect(Math.max(...sourceNodes.map((n) => n.column))).toBe(0);
    expect(Math.max(...deliveryNodes.map((n) => n.column))).toBeGreaterThan(
      Math.max(...processNodes.map((n) => n.column)),
    );
  });

  it("agrega tabelul Materiale si origine cu procente ce insumeaza 100%", () => {
    const { materials } = buildTraceabilityGraph(mockupScenario());

    expect(materials).toHaveLength(3);
    const totalPct = materials.reduce((sum, m) => sum + m.percentage, 0);
    expect(totalPct).toBeCloseTo(100, 0);

    const clay = materials.find((m) => m.material === "Argilă reciclată");
    expect(clay?.origin).toBe("Reciclare");
    expect(clay?.source).toBe("Ceramheld SRL");
    // 3000 din 4000 (3000+570+430) ≈ 75%
    expect(clay?.percentage).toBeCloseTo(75, 0);
  });

  it("marcheaza recondiționarea distinct de reciclare (AGENTS.md §4)", () => {
    // Lant pe 2 niveluri: lot returnat -> proces de recondiționare -> lot recondiționat,
    // livrat direct (fara alt proces deasupra).
    const data: TraceabilityRawData = {
      delivered: [
        {
          lotId: "lot-recond",
          itemId: "item-pallet",
          itemTitle: "Palet reconditionat",
          unit: "bucata",
          quantity: 50,
        },
      ],
      lots: {
        "lot-return": {
          id: "lot-return",
          itemId: "item-pallet",
          itemTitle: "Palet uzat",
          unit: "bucata",
          provenance: "return",
          source: "Client Apex SRL",
          entryDate: "2026-05-01",
        },
        "lot-recond": {
          id: "lot-recond",
          itemId: "item-pallet",
          itemTitle: "Palet reconditionat",
          unit: "bucata",
          provenance: "reconditioning",
          source: null,
          entryDate: "2026-05-10",
        },
      },
      processes: {
        "proc-recond": { id: "proc-recond", type: "input_fixed", completedAt: "2026-05-10" },
      },
      outputByLot: {
        "lot-recond": { processId: "proc-recond", lotId: "lot-recond", quantity: 50 },
      },
      inputsByProcess: {
        "proc-recond": [{ processId: "proc-recond", lotId: "lot-return", quantity: 50 }],
      },
    };

    const { graph, materials } = buildTraceabilityGraph(data);

    const processNode = graph.nodes.find((n) => n.kind === "process");
    expect(processNode?.sublabel).toBe("Recondiționare");

    expect(materials).toHaveLength(1);
    expect(materials[0].origin).toBe("Retur");
    expect(materials[0].percentage).toBe(100);
  });

  it("gestioneaza mai multe linii livrate (itemi diferiti) fara sa amestece loturile", () => {
    const scenario = mockupScenario();
    scenario.delivered.push({
      lotId: "lot-cement",
      itemId: "item-cement",
      itemTitle: "Ciment Portland",
      unit: "kg",
      quantity: 100,
    });

    const { graph } = buildTraceabilityGraph(scenario);
    const deliveryNodes = graph.nodes.filter((n) => n.kind === "delivery");
    expect(deliveryNodes).toHaveLength(2);
  });
});
