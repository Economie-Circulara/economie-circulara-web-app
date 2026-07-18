import { PROVENANCE_LABELS } from "@/features/stock/labels";
import type { SankeyData, SankeyLink, SankeyNode } from "@/features/production/sankey-data";
import type { DeliveredLotLine, MaterialOriginRow, RawLot, TraceabilityRawData } from "./types";

/**
 * Constructia graf-ului de trasabilitate — Task G, sectiunea 1 din
 * docs/plans/task-g-certificate.md. Traversare de graf PURA (fara Supabase),
 * testabila cu date mock (traceability.test.ts): pornind de la loturile efectiv
 * livrate (consumate la acceptarea comenzii), mergem INAPOI prin
 * `process_outputs` -> `processes` -> `process_inputs` -> loturi de materie
 * prima, recursiv, pana la loturi fara proces care le-a produs ("surse" —
 * achizitie/retur/ajustare/reciclare sau recondiționare directa fara lant
 * anterior cunoscut).
 *
 * Noduri (vezi SankeyNodeKind): "source" (furnizor/proveniența libera) ->
 * "lot" (fiecare lot, la orice nivel) -> "process" (proces de transformare) ->
 * ... -> "delivery" (produsul efectiv livrat pe aceasta comanda). Coloana
 * fiecarui nod se calculeaza dinamic (nu e fixa la 3 ca la Sankey-ul de proces
 * unic — un certificat poate avea lanturi de adancimi diferite, ex.
 * recondiționare urmata de o noua productie).
 *
 * Alocarea cantitatilor (mass-balance simplificat, fara conversii de UM — vezi
 * AGENTS.md §4 "Un UM unic per produs; fara conversii intre unitati"): daca
 * dintr-un lot produs in cantitate `totalOutputQty` de un proces s-a consumat
 * doar `qty` pentru aceasta comanda, presupunem un amestec omogen si atribuim
 * fiecarui input al procesului o cota proportionala `qty / totalOutputQty`.
 * Aceeasi cota se propaga recursiv in adancime. Nu se valideaza randamentul
 * (pierderile de proces raman doar informative — AGENTS.md §4), deci suma
 * cantitatilor atribuite surselor poate sa nu acopere exact 100% din masa
 * initiala a proceselor intermediare; procentele din tabelul "Materiale și
 * origine" insumeaza mereu 100% intre ele (sunt normalizate la finalul livrat).
 */

interface BuildContext {
  data: TraceabilityRawData;
  nodes: Map<string, SankeyNode>;
  links: SankeyLink[];
  materials: Map<string, MaterialOriginRow>;
  seq: number;
}

const MAX_DEPTH = 40;

function nextId(ctx: BuildContext, prefix: string): string {
  ctx.seq += 1;
  return `${prefix}:${ctx.seq}`;
}

function formatQty(qty: number, unit: string): string {
  return `${round(qty).toLocaleString("ro-RO")} ${unit}`;
}

function round(value: number, decimals = 3): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function processLabel(processId: string): string {
  return `Proces ${processId.slice(0, 8).toUpperCase()}`;
}

function addMaterial(ctx: BuildContext, lot: RawLot, qty: number): void {
  if (qty <= 0) return;
  const key = `${lot.provenance}|${lot.source ?? ""}|${lot.itemTitle}`;
  const existing = ctx.materials.get(key);
  if (existing) {
    existing.quantity += qty;
    return;
  }
  ctx.materials.set(key, {
    material: lot.itemTitle,
    origin: PROVENANCE_LABELS[lot.provenance],
    source: lot.source ?? "—",
    quantity: qty,
    unit: lot.unit,
    percentage: 0, // completat la final, dupa ce se cunoaste totalul
  });
}

/**
 * Rezolva un lot (recursiv, inapoi in lant) si intoarce nodul terminal ("lot")
 * plus coloana lui. `ancestry` e o garda anti-ciclu (datele ar trebui sa fie
 * mereu un DAG — loturile se creeaza o singura data — dar o bucla in date
 * corupte nu trebuie sa blocheze generarea certificatului).
 */
function resolveLot(
  ctx: BuildContext,
  lotId: string,
  qty: number,
  ancestry: ReadonlySet<string>,
  depth: number,
): { nodeId: string; column: number } {
  const lot = ctx.data.lots[lotId];
  if (!lot) {
    // Lot referit dar nu a fost incarcat (nu ar trebui sa se intample daca
    // repository.ts si-a facut treaba) — tratam ca sursa necunoscuta, defensiv.
    const nodeId = nextId(ctx, "unknown");
    ctx.nodes.set(nodeId, {
      id: nodeId,
      label: "Lot necunoscut",
      column: 0,
      value: qty,
      kind: "lot",
    });
    return { nodeId, column: 0 };
  }

  const output = ctx.data.outputByLot[lotId];
  const isCycle = ancestry.has(lotId);

  if (!output || isCycle || depth >= MAX_DEPTH) {
    // Nod terminal: sursa (furnizor/proveniența) -> lot.
    const sourceNodeId = nextId(ctx, "src");
    ctx.nodes.set(sourceNodeId, {
      id: sourceNodeId,
      label: lot.source ?? PROVENANCE_LABELS[lot.provenance],
      sublabel: PROVENANCE_LABELS[lot.provenance],
      column: 0,
      value: qty,
      kind: "source",
    });

    const lotNodeId = nextId(ctx, "lot");
    ctx.nodes.set(lotNodeId, {
      id: lotNodeId,
      label: lot.itemTitle,
      sublabel: formatQty(qty, lot.unit),
      column: 1,
      value: qty,
      kind: "lot",
    });

    ctx.links.push({
      id: `${sourceNodeId}->${lotNodeId}`,
      source: sourceNodeId,
      target: lotNodeId,
      value: qty,
    });
    addMaterial(ctx, lot, qty);
    return { nodeId: lotNodeId, column: 1 };
  }

  const process = ctx.data.processes[output.processId];
  const inputs = ctx.data.inputsByProcess[output.processId] ?? [];
  const ratio = output.quantity > 0 ? qty / output.quantity : 0;
  const nextAncestry = new Set(ancestry);
  nextAncestry.add(lotId);

  let maxInputColumn = -1;
  const resolvedInputs = inputs.map((input) => {
    const attributed = round(input.quantity * ratio);
    const resolved = resolveLot(ctx, input.lotId, attributed, nextAncestry, depth + 1);
    maxInputColumn = Math.max(maxInputColumn, resolved.column);
    return { ...resolved, attributed };
  });

  const processColumn = maxInputColumn + 1;
  const processNodeId = nextId(ctx, "proc");
  ctx.nodes.set(processNodeId, {
    id: processNodeId,
    label: process ? processLabel(process.id) : "Proces necunoscut",
    sublabel: PROVENANCE_LABELS[lot.provenance],
    column: processColumn,
    value: qty,
    kind: "process",
  });
  resolvedInputs.forEach((input) => {
    if (input.attributed <= 0) return;
    ctx.links.push({
      id: `${input.nodeId}->${processNodeId}`,
      source: input.nodeId,
      target: processNodeId,
      value: input.attributed,
    });
  });

  const lotColumn = processColumn + 1;
  const lotNodeId = nextId(ctx, "lot");
  ctx.nodes.set(lotNodeId, {
    id: lotNodeId,
    label: lot.itemTitle,
    sublabel: formatQty(qty, lot.unit),
    column: lotColumn,
    value: qty,
    kind: "lot",
  });
  ctx.links.push({
    id: `${processNodeId}->${lotNodeId}`,
    source: processNodeId,
    target: lotNodeId,
    value: qty,
  });

  return { nodeId: lotNodeId, column: lotColumn };
}

export interface BuiltTraceabilityGraph {
  graph: SankeyData;
  materials: MaterialOriginRow[];
}

/**
 * Construieste graful complet (surse -> loturi -> procese -> ... -> livrare)
 * plus tabelul "Materiale si origine" (procent per sursa/provenienta), pornind
 * de la loturile efectiv livrate pe o comanda. Functie PURA — nicio dependenta
 * de Supabase; testabila direct cu date mock (vezi traceability.test.ts).
 */
export function buildTraceabilityGraph(data: TraceabilityRawData): BuiltTraceabilityGraph {
  const ctx: BuildContext = {
    data,
    nodes: new Map(),
    links: [],
    materials: new Map(),
    seq: 0,
  };

  if (data.delivered.length === 0) {
    return { graph: { nodes: [], links: [] }, materials: [] };
  }

  const deliveredByItem = new Map<
    string,
    { itemTitle: string; unit: string; lines: DeliveredLotLine[] }
  >();
  for (const line of data.delivered) {
    const bucket = deliveredByItem.get(line.itemId) ?? {
      itemTitle: line.itemTitle,
      unit: line.unit,
      lines: [],
    };
    bucket.lines.push(line);
    deliveredByItem.set(line.itemId, bucket);
  }

  let maxColumn = 0;
  const resolvedByItem: {
    itemId: string;
    itemTitle: string;
    unit: string;
    nodeIds: string[];
    total: number;
  }[] = [];

  for (const [itemId, bucket] of deliveredByItem) {
    const nodeIds: string[] = [];
    let total = 0;
    for (const line of bucket.lines) {
      const resolved = resolveLot(ctx, line.lotId, line.quantity, new Set(), 0);
      maxColumn = Math.max(maxColumn, resolved.column);
      nodeIds.push(resolved.nodeId);
      total += line.quantity;
    }
    resolvedByItem.push({ itemId, itemTitle: bucket.itemTitle, unit: bucket.unit, nodeIds, total });
  }

  const deliveryColumn = maxColumn + 1;
  for (const item of resolvedByItem) {
    const deliveryNodeId = nextId(ctx, "delivery");
    ctx.nodes.set(deliveryNodeId, {
      id: deliveryNodeId,
      label: item.itemTitle,
      sublabel: `${formatQty(item.total, item.unit)} livrat`,
      column: deliveryColumn,
      value: item.total,
      kind: "delivery",
    });
    for (const nodeId of item.nodeIds) {
      const node = ctx.nodes.get(nodeId);
      ctx.links.push({
        id: `${nodeId}->${deliveryNodeId}`,
        source: nodeId,
        target: deliveryNodeId,
        value: node?.value ?? 0,
      });
    }
  }

  const materials = finalizeMaterials(ctx.materials);
  return { graph: { nodes: [...ctx.nodes.values()], links: ctx.links }, materials };
}

function finalizeMaterials(materials: Map<string, MaterialOriginRow>): MaterialOriginRow[] {
  const rows = [...materials.values()];
  const total = rows.reduce((sum, row) => sum + row.quantity, 0);
  rows.forEach((row) => {
    row.quantity = round(row.quantity);
    row.percentage = total > 0 ? round((row.quantity / total) * 100, 1) : 0;
  });
  rows.sort((a, b) => b.percentage - a.percentage);
  return rows;
}
