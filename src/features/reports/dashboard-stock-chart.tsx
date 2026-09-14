"use client";

import { useState } from "react";
import type { DashboardStockTrend } from "./types";

const quantityFormatter = new Intl.NumberFormat("ro-RO", { maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("ro-RO", { day: "2-digit", month: "short" });

function pointCoordinates(trend: DashboardStockTrend) {
  const width = 640;
  const height = 250;
  const padding = { top: 18, right: 18, bottom: 36, left: 66 };
  const quantities = trend.points.map((point) => point.quantity);
  const minimum = Math.min(...quantities, 0);
  const maximum = Math.max(...quantities, 1);
  const span = Math.max(maximum - minimum, 1);
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const x = (index: number) =>
    padding.left + (index / Math.max(trend.points.length - 1, 1)) * plotWidth;
  const y = (quantity: number) => padding.top + ((maximum - quantity) / span) * plotHeight;

  return {
    width,
    height,
    padding,
    minimum,
    maximum,
    x,
    y,
    line: trend.points.map((point, index) => `${x(index)},${y(point.quantity)}`).join(" "),
    area: `${padding.left},${height - padding.bottom} ${trend.points
      .map((point, index) => `${x(index)},${y(point.quantity)}`)
      .join(" ")} ${width - padding.right},${height - padding.bottom}`,
  };
}

export function DashboardStockChart({ trends }: { trends: DashboardStockTrend[] }) {
  const [unit, setUnit] = useState(trends[0]?.unit ?? "");
  const trend = trends.find((candidate) => candidate.unit === unit) ?? trends[0];

  if (!trend) {
    return (
      <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">
        Nu există încă mișcări sau loturi pentru a construi evoluția stocului.
      </div>
    );
  }

  const chart = pointCoordinates(trend);
  const tickIndexes = [0, Math.floor((trend.points.length - 1) / 2), trend.points.length - 1];
  const current = trend.points.at(-1)?.quantity ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-bold tabular-nums">
            {quantityFormatter.format(current)}{" "}
            <span className="text-base font-medium">{trend.unit}</span>
          </p>
          <p className="text-xs text-muted-foreground">Disponibil la acest moment</p>
        </div>
        {trends.length > 1 ? (
          <label className="grid gap-1 text-xs font-medium text-muted-foreground">
            Unitate de măsură
            <select
              value={trend.unit}
              onChange={(event) => setUnit(event.target.value)}
              className="h-8 rounded-md border bg-card px-2 text-sm font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Unitate de măsură pentru evoluția stocului"
            >
              {trends.map((candidate) => (
                <option key={candidate.unit} value={candidate.unit}>
                  {candidate.unit}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>

      <svg
        viewBox={`0 0 ${chart.width} ${chart.height}`}
        className="h-auto w-full overflow-visible"
        role="img"
        aria-label={`Evoluția stocului în ${trend.unit} în ultimele 14 zile`}
      >
        <title>Evoluția stocului în ultimele 14 zile</title>
        <defs>
          <linearGradient id="stock-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--brand)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {[0, 0.5, 1].map((step) => {
          const value = chart.maximum - (chart.maximum - chart.minimum) * step;
          const y = chart.y(value);
          return (
            <g key={step}>
              <line
                x1={chart.padding.left}
                x2={chart.width - chart.padding.right}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
              />
              <text
                x={chart.padding.left - 9}
                y={y + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[11px]"
              >
                {quantityFormatter.format(value)}
              </text>
            </g>
          );
        })}
        <polygon points={chart.area} fill="url(#stock-area)" />
        <polyline
          points={chart.line}
          fill="none"
          stroke="var(--brand)"
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {trend.points.map((point, index) => (
          <circle
            key={point.date}
            cx={chart.x(index)}
            cy={chart.y(point.quantity)}
            r="3.5"
            fill="var(--card)"
            stroke="var(--brand)"
            strokeWidth="2"
          >
            <title>{`${dateFormatter.format(new Date(`${point.date}T00:00:00Z`))}: ${quantityFormatter.format(point.quantity)} ${trend.unit}`}</title>
          </circle>
        ))}
        {tickIndexes.map((index) => (
          <text
            key={trend.points[index].date}
            x={chart.x(index)}
            y={chart.height - 12}
            textAnchor={
              index === 0 ? "start" : index === trend.points.length - 1 ? "end" : "middle"
            }
            className="fill-muted-foreground text-[11px]"
          >
            {dateFormatter.format(new Date(`${trend.points[index].date}T00:00:00Z`))}
          </text>
        ))}
      </svg>
    </div>
  );
}
