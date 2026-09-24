"use client";

import { useCallback, useRef } from "react";
import { Lock, LockOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { applyDividerDrag, computeSegmentWidths, roundTo } from "./quantity-calc";

/**
 * Culori pentru segmentele barei - paleta categoriala neutra (nu depinde de branding),
 * ciclata daca sunt mai multe componente decat culori.
 */
const SEGMENT_COLORS = [
  "bg-sky-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-violet-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-lime-500",
  "bg-fuchsia-500",
] as const;

export interface ProportionBarRow {
  id: string;
  label: string;
  percentage: number;
  locked?: boolean;
}

const DRAG_STEP = 1; // puncte procentuale per apasare de sageata
const DRAG_STEP_FINE = 0.1; // cu Shift

/**
 * Bara stivuita 100% latime, cu un segment colorat per componenta a rețetei si
 * granite trăgabile intre segmente adiacente (pointer + tastatura). Dragging
 * transfera puncte procentuale intre cele doua segmente adiacente granitei -
 * suma totala a procentelor NU se schimba (asta o face doar formularul de
 * cantitati, care poate adauga/scoate material). Segmentele blocate (`locked`)
 * isi pastreaza granitele fixe.
 */
export function ProportionBar({
  rows,
  onChange,
  onToggleLock,
}: {
  rows: ProportionBarRow[];
  onChange: (next: ProportionBarRow[]) => void;
  onToggleLock: (id: string) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);
  const segments = computeSegmentWidths(rows);
  const total = rows.reduce((sum, r) => sum + Math.max(r.percentage, 0), 0);

  const dragState = useRef<{ dividerIndex: number; pointerId: number; startX: number } | null>(
    null,
  );

  const moveDivider = useCallback(
    (dividerIndex: number, deltaPercentPoints: number) => {
      onChange(applyDividerDrag(rows, dividerIndex, deltaPercentPoints));
    },
    [rows, onChange],
  );

  const handlePointerDown = (dividerIndex: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragState.current = { dividerIndex, pointerId: e.pointerId, startX: e.clientX };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const drag = dragState.current;
    const bar = barRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !bar) return;
    const barWidth = bar.getBoundingClientRect().width;
    if (barWidth <= 0 || total <= 0) return;
    const dx = e.clientX - drag.startX;
    // 1px = (total procente / latimea barei) puncte procentuale - vezi computeSegmentWidths,
    // care normalizeaza latimile la `total`.
    const deltaPercentPoints = (dx / barWidth) * total;
    drag.startX = e.clientX;
    moveDivider(drag.dividerIndex, deltaPercentPoints);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragState.current?.pointerId === e.pointerId) dragState.current = null;
  };

  const handleKeyDown = (dividerIndex: number) => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? DRAG_STEP_FINE : DRAG_STEP;
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      moveDivider(dividerIndex, -step);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      moveDivider(dividerIndex, step);
    }
  };

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Adaugă cel puțin o materie primă ca să vezi bara de proporții.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div
        ref={barRef}
        className="relative flex h-9 w-full overflow-hidden rounded-md border"
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {segments.map((segment, index) => {
          const row = rows[index];
          const color = SEGMENT_COLORS[index % SEGMENT_COLORS.length];
          const nextRow = rows[index + 1];
          const dividerDisabled = !nextRow || row.locked || nextRow.locked;
          return (
            <div
              key={segment.id}
              className={cn("relative flex items-center justify-center", color)}
              style={{ width: `${segment.widthPercent}%` }}
              title={`${row.label}: ${roundTo(row.percentage, 3)}%`}
            >
              {segment.widthPercent > 8 ? (
                <span className="truncate px-1 text-xs font-medium text-white">
                  {roundTo(row.percentage, 1)}%
                </span>
              ) : null}
              {nextRow ? (
                <div
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Graniță între ${row.label} și ${nextRow.label}`}
                  tabIndex={dividerDisabled ? -1 : 0}
                  onPointerDown={dividerDisabled ? undefined : handlePointerDown(index)}
                  onKeyDown={dividerDisabled ? undefined : handleKeyDown(index)}
                  className={cn(
                    "absolute inset-y-0 right-0 z-10 w-2 -mr-1 touch-none",
                    dividerDisabled
                      ? "cursor-not-allowed"
                      : "cursor-col-resize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {rows.map((row, index) => (
          <li key={row.id} className="flex items-center gap-2">
            <span
              className={cn("size-2.5 rounded-full", SEGMENT_COLORS[index % SEGMENT_COLORS.length])}
              aria-hidden
            />
            <span>{row.label}</span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {roundTo(row.percentage, 3)}%
            </span>
            <button
              type="button"
              onClick={() => onToggleLock(row.id)}
              className="text-muted-foreground hover:text-foreground"
              aria-pressed={Boolean(row.locked)}
              aria-label={row.locked ? `Deblochează ${row.label}` : `Blochează ${row.label}`}
              title={
                row.locked
                  ? "Deblochează proporția"
                  : "Blochează proporția (nu se mișcă la tragere)"
              }
            >
              {row.locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
