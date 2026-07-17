import type { ProcessLotLine } from "./types";

/** Coloana (0 = input, 1 = proces, 2 = output) pentru layout-ul in 3 coloane. */
export type SankeyColumn = 0 | 1 | 2;

export interface SankeyNode {
  id: string;
  label: string;
  sublabel?: string;
  column: SankeyColumn;
  value: number;
}

export interface SankeyLink {
  id: string;
  source: string;
  target: string;
  value: number;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
}

const PROCESS_NODE_ID = "process";

/**
 * Mapeaza `process_inputs`/`process_outputs` (deja incarcate in `ProcessDetail`)
 * la forma generica noduri/legaturi consumata de `SankeyDiagram` — loturi de
 * input → nodul de proces → loturi de output (vezi spike S3 pentru alegerea
 * implementarii Sankey; aceasta functie e pura, testabila fara React/SVG).
 */
export function buildProcessSankeyData(
  detail: { inputs: ProcessLotLine[]; outputs: ProcessLotLine[] },
  processLabel = "Proces",
): SankeyData {
  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];

  let totalIn = 0;
  detail.inputs.forEach((line, index) => {
    const nodeId = `in:${line.lotId}:${index}`;
    nodes.push({
      id: nodeId,
      label: line.itemTitle,
      sublabel: formatQty(line.quantity, line.unit),
      column: 0,
      value: line.quantity,
    });
    links.push({ id: nodeId, source: nodeId, target: PROCESS_NODE_ID, value: line.quantity });
    totalIn += line.quantity;
  });

  let totalOut = 0;
  detail.outputs.forEach((line, index) => {
    const nodeId = `out:${line.lotId}:${index}`;
    nodes.push({
      id: nodeId,
      label: line.itemTitle,
      sublabel: formatQty(line.quantity, line.unit),
      column: 2,
      value: line.quantity,
    });
    links.push({ id: nodeId, source: PROCESS_NODE_ID, target: nodeId, value: line.quantity });
    totalOut += line.quantity;
  });

  nodes.push({
    id: PROCESS_NODE_ID,
    label: processLabel,
    column: 1,
    value: Math.max(totalIn, totalOut),
  });

  return { nodes, links };
}

function formatQty(qty: number, unit: string): string {
  return `${qty.toLocaleString("ro-RO")} ${unit}`;
}
