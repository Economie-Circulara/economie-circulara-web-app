import type { ProcessLotLine } from "./types";

/**
 * Coloana in layout-ul pe N coloane (0..n). Procesele de productie/reciclare
 * folosesc mereu 3 coloane fixe (0 = input, 1 = proces, 2 = output); certificatul
 * de trasabilitate (Task G, src/features/certificates/traceability.ts) foloseste
 * un numar variabil de coloane (surse → loturi → procese → ... → livrare, in
 * functie de adancimea lantului) — de-aici tipul larg `number`, nu o uniune fixa.
 */
export type SankeyColumn = number;

/** Categoria unui nod — optionala, folosita doar de certificat (Task G) pt. stil/culoare. */
export type SankeyNodeKind = "source" | "lot" | "process" | "delivery";

export interface SankeyNode {
  id: string;
  label: string;
  sublabel?: string;
  column: SankeyColumn;
  value: number;
  kind?: SankeyNodeKind;
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

// -----------------------------------------------------------------------------
// Layout pur (fara React/DOM) — calculeaza pozitiile nodurilor (rect-uri) si
// curbele Bezier ale "panglicilor" dintre coloane. Extras din `sankey-diagram.tsx`
// (era o functie locala, ne-exportata) ca sa poata fi reutilizat si de PDF-ul
// certificatului (Task G, src/features/certificates/pdf.tsx), care deseneaza
// acelasi graf cu primitivele <Svg>/<Rect>/<Path> din @react-pdf/renderer — un
// singur loc care calculeaza geometria, doua randari (browser SVG + PDF).
// -----------------------------------------------------------------------------

export interface SankeyPositionedNode extends SankeyNode {
  x: number;
  y: number;
  h: number;
}

export interface SankeyRibbon {
  id: string;
  d: string;
  label: string;
  value: string;
}

export interface SankeyLayoutOptions {
  width?: number;
  height?: number;
  nodeWidth?: number;
  pad?: number;
  gap?: number;
}

const DEFAULT_LAYOUT = { width: 680, height: 260, nodeWidth: 14, pad: 6, gap: 10 };

interface MutablePositionedNode extends SankeyPositionedNode {
  outOffset: number;
  inOffset: number;
}

/** Layout-ul complet (noduri pozitionate + panglici) pentru un `SankeyData` pe N coloane. */
export function layoutSankey(
  data: SankeyData,
  options: SankeyLayoutOptions = {},
): { positioned: SankeyPositionedNode[]; ribbons: SankeyRibbon[]; nodeWidth: number } {
  const { width, height, nodeWidth, pad, gap } = { ...DEFAULT_LAYOUT, ...options };

  const columns = new Map<number, SankeyNode[]>();
  data.nodes.forEach((node) => {
    const arr = columns.get(node.column) ?? [];
    arr.push(node);
    columns.set(node.column, arr);
  });

  const columnKeys = [...columns.keys()].sort((a, b) => a - b);
  const maxSum = Math.max(1, ...columnKeys.map((c) => sumValues(columns.get(c) ?? [])));
  const maxCount = Math.max(1, ...columnKeys.map((c) => (columns.get(c) ?? []).length));
  const scaleH = (height - gap * (maxCount - 1)) / maxSum;
  const colCount = Math.max(1, columnKeys.length - 1);

  const positions = new Map<string, MutablePositionedNode>();
  columnKeys.forEach((col, colIndex) => {
    const nodesInCol = columns.get(col) ?? [];
    const sum = sumValues(nodesInCol);
    const totalHeight = sum * scaleH + gap * (nodesInCol.length - 1);
    let y = (height - totalHeight) / 2;
    const x = pad + colIndex * ((width - 2 * pad - nodeWidth) / colCount);
    nodesInCol.forEach((node) => {
      const h = Math.max(3, node.value * scaleH);
      positions.set(node.id, { ...node, x, y, h, outOffset: 0, inOffset: 0 });
      y += h + gap;
    });
  });

  const ribbons: SankeyRibbon[] = data.links.map((link) => {
    const source = positions.get(link.source);
    const target = positions.get(link.target);
    if (!source || !target) return { id: link.id, d: "", label: "", value: "" };

    const linkHeight = Math.max(1.5, link.value * scaleH);
    const sy0 = source.y + source.outOffset;
    const sy1 = sy0 + linkHeight;
    source.outOffset += linkHeight;
    const ty0 = target.y + target.inOffset;
    const ty1 = ty0 + linkHeight;
    target.inOffset += linkHeight;

    const x0 = source.x + nodeWidth;
    const x1 = target.x;
    const xm = (x0 + x1) / 2;
    const d = `M${x0},${sy0} C${xm},${sy0} ${xm},${ty0} ${x1},${ty0} L${x1},${ty1} C${xm},${ty1} ${xm},${sy1} ${x0},${sy1} Z`;

    return {
      id: link.id,
      d,
      label: `${source.label} → ${target.label}`,
      value: link.value.toLocaleString("ro-RO"),
    };
  });

  return { positioned: [...positions.values()], ribbons, nodeWidth };
}

function sumValues(nodes: SankeyNode[]): number {
  return nodes.reduce((sum, node) => sum + node.value, 0);
}
