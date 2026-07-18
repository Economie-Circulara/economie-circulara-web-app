"use client";

import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { layoutSankey, type SankeyData } from "./sankey-data";

export interface SankeyDiagramProps {
  data: SankeyData;
  className?: string;
  /** Inaltimea (viewBox) desenului — latimea e mereu 100% (responsive). */
  height?: number;
}

const NODE_WIDTH = 14;
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

  const { positioned, ribbons } = useMemo(
    () => layoutSankey(data, { width: WIDTH, height, nodeWidth: NODE_WIDTH }),
    [data, height],
  );
  // Coloana maxima a graf-ului curent — folosita ca sa generalizam alinierea
  // pentru un numar variabil de coloane (certificatul de trasabilitate, Task G,
  // poate avea mai mult de 3 coloane in functie de adancimea lantului), fara sa
  // schimbam vizual layout-ul fix pe 3 coloane al proceselor de productie.
  const maxColumn = positioned.length > 0 ? Math.max(...positioned.map((n) => n.column)) : 0;

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
            const rightAligned = node.column === maxColumn;
            // Centrarea deasupra nodului se pastreaza DOAR pentru layout-ul clasic
            // pe 3 coloane (procesul, la mijloc) — un graf cu mai multe coloane
            // (certificat) foloseste aliniere start/end simpla, fara centrare.
            const centered = maxColumn === 2 && node.column === 1;
            const textX = centered
              ? node.x + NODE_WIDTH / 2
              : rightAligned
                ? node.x - 7
                : node.x + NODE_WIDTH + 7;
            // `kind` (opțional, Task G) prevaleaza asupra pozitiei pe coloana:
            // un nod de tip "process" e mereu colorat cu brand-ul, indiferent pe
            // ce coloana ajunge intr-un lant de adancime variabila.
            const isBrandColored = node.kind ? node.kind === "process" : node.column === 1;
            return (
              <g key={node.id}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_WIDTH}
                  height={node.h}
                  rx={3}
                  fill={isBrandColored ? "var(--brand, #2b3a2f)" : "var(--accent, #4d6b53)"}
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
