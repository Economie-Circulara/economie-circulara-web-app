"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import type { SankeyData, SankeyNode } from "./sankey-data";

export interface SankeyDiagramProps {
  data: SankeyData;
  className?: string;
  /** Inaltimea (viewBox) desenului — latimea e mereu 100% (responsive). */
  height?: number;
}

interface PositionedNode extends SankeyNode {
  x: number;
  y: number;
  h: number;
  outOffset: number;
  inOffset: number;
}

const NODE_WIDTH = 14;
const PAD = 6;
const GAP = 10;
const WIDTH = 680;

/**
 * Sankey minimal, dependency-free (SVG + React), pe 3 coloane fixe: loturi de
 * input → proces → loturi de output. Vezi spike S3 (implementation-plan.md) —
 * decizie: NU am adaugat o librarie externa (recharts/@nivo/sankey); ambele au
 * risc de compatibilitate cu React 19 / Next 16 (peer deps neactualizate la data
 * scrierii) si aduc bundle semnificativ pentru un caz de folosire simplu (2 legaturi
 * intre 3 coloane, fara noduri intermediare multiple). Mockup-ul de design
 * (docs/design/Lateris_Trace.dc.html#buildSankey) foloseste deja exact acest
 * pattern (rect-uri + path-uri Bezier ca "panglici"), reluat aici 1:1 in React,
 * tipizat, testabil (`sankey-data.ts` e pur si separat de randare).
 */
export function SankeyDiagram({ data, className, height = 260 }: SankeyDiagramProps) {
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    value: string;
  } | null>(null);

  const { positioned, ribbons } = useMemo(() => layout(data, WIDTH, height), [data, height]);

  if (data.nodes.length === 0) {
    return (
      <div
        className={cn("flex items-center justify-center text-sm text-muted-foreground", className)}
      >
        Fara loturi de afișat.
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${WIDTH} ${height}`}
        width="100%"
        style={{ display: "block", overflow: "visible" }}
      >
        <g>
          {ribbons.map((ribbon) => (
            <path
              key={ribbon.id}
              d={ribbon.d}
              fill="var(--accent, #4d6b53)"
              opacity={0.35}
              onMouseEnter={(e) =>
                setTooltip({ x: e.clientX, y: e.clientY, label: ribbon.label, value: ribbon.value })
              }
              onMouseMove={(e) => setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))}
              onMouseLeave={() => setTooltip(null)}
            />
          ))}
        </g>
        <g>
          {positioned.map((node) => {
            const rightAligned = node.column === 2;
            const centered = node.column === 1;
            const textX = centered
              ? node.x + NODE_WIDTH / 2
              : rightAligned
                ? node.x - 7
                : node.x + NODE_WIDTH + 7;
            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_WIDTH}
                  height={node.h}
                  rx={3}
                  fill={node.column === 1 ? "var(--brand, #2b3a2f)" : "var(--accent, #4d6b53)"}
                  onMouseEnter={(e) =>
                    setTooltip({
                      x: e.clientX,
                      y: e.clientY,
                      label: node.label,
                      value: node.sublabel ?? String(node.value),
                    })
                  }
                  onMouseMove={(e) =>
                    setTooltip((t) => (t ? { ...t, x: e.clientX, y: e.clientY } : t))
                  }
                  onMouseLeave={() => setTooltip(null)}
                  style={{ cursor: "pointer" }}
                />
                <text
                  x={textX}
                  y={node.y + node.h / 2 - (node.sublabel ? 6 : 0)}
                  textAnchor={centered ? "middle" : rightAligned ? "end" : "start"}
                  dominantBaseline="middle"
                  fontSize={11}
                  fontWeight={600}
                  fill="currentColor"
                >
                  {node.label}
                </text>
                {node.sublabel ? (
                  <text
                    x={textX}
                    y={node.y + node.h / 2 + 9}
                    textAnchor={centered ? "middle" : rightAligned ? "end" : "start"}
                    dominantBaseline="middle"
                    fontSize={9.5}
                    fill="currentColor"
                    opacity={0.6}
                  >
                    {node.sublabel}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      {tooltip ? (
        <div
          className="pointer-events-none fixed z-50 rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md"
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
        >
          <div className="font-medium">{tooltip.label}</div>
          <div className="text-muted-foreground">{tooltip.value}</div>
        </div>
      ) : null}
    </div>
  );
}

interface Ribbon {
  id: string;
  d: string;
  label: string;
  value: string;
}

function layout(
  data: SankeyData,
  width: number,
  height: number,
): { positioned: PositionedNode[]; ribbons: Ribbon[] } {
  const columns = new Map<number, SankeyNode[]>();
  data.nodes.forEach((node) => {
    const arr = columns.get(node.column) ?? [];
    arr.push(node);
    columns.set(node.column, arr);
  });

  const columnKeys = [...columns.keys()].sort((a, b) => a - b);
  const maxSum = Math.max(1, ...columnKeys.map((c) => sumValues(columns.get(c) ?? [])));
  const maxCount = Math.max(1, ...columnKeys.map((c) => (columns.get(c) ?? []).length));
  const scaleH = (height - GAP * (maxCount - 1)) / maxSum;
  const colCount = Math.max(1, columnKeys.length - 1);

  const positions = new Map<string, PositionedNode>();
  columnKeys.forEach((col, colIndex) => {
    const nodesInCol = columns.get(col) ?? [];
    const sum = sumValues(nodesInCol);
    const totalHeight = sum * scaleH + GAP * (nodesInCol.length - 1);
    let y = (height - totalHeight) / 2;
    const x = PAD + colIndex * ((width - 2 * PAD - NODE_WIDTH) / colCount);
    nodesInCol.forEach((node) => {
      const h = Math.max(3, node.value * scaleH);
      positions.set(node.id, { ...node, x, y, h, outOffset: 0, inOffset: 0 });
      y += h + GAP;
    });
  });

  const ribbons: Ribbon[] = data.links.map((link) => {
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

    const x0 = source.x + NODE_WIDTH;
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

  return { positioned: [...positions.values()], ribbons };
}

function sumValues(nodes: SankeyNode[]): number {
  return nodes.reduce((sum, node) => sum + node.value, 0);
}
