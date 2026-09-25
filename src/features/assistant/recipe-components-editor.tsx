"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DIRECTION_COMPONENT_ROLE, DIRECTION_PERCENTAGE_HINTS } from "@/features/recipes/labels";
import type { RecipeDirection } from "@/features/recipes/types";
import { isPercentageSumComplete, sumPercentages } from "@/features/recipes/validation";

export const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none";

/** Un rand editabil de materie prima (procentul ramane text cat timp se tasteaza). */
export interface ComponentRow {
  key: number;
  itemId: string;
  percentage: string;
  /** Numele din documentul sursa - aratat cand materialul n-a fost potrivit automat. */
  sourceName?: string;
}

export interface ComponentOption {
  id: string;
  title: string;
  unit: string;
}

export function toComponentRows(
  components: { itemId: string | null; percentage: number; sourceName?: string }[],
): ComponentRow[] {
  return components.map((component, index) => ({
    key: index,
    itemId: component.itemId ?? "",
    percentage: String(component.percentage),
    sourceName: component.sourceName,
  }));
}

export function parseComponentRows(rows: ComponentRow[]) {
  return rows.map((row) => ({
    itemId: row.itemId,
    percentage: Number(row.percentage.replace(",", ".")),
  }));
}

/** Toate randurile au material ales si procent pozitiv. */
export function componentRowsValid(rows: ComponentRow[]): boolean {
  const parsed = parseComponentRows(rows);
  return (
    parsed.length > 0 &&
    parsed.every((row) => row.itemId && Number.isFinite(row.percentage) && row.percentage > 0)
  );
}

/**
 * Lista editabila de materii prime (material + procent, add/remove) - partajata de
 * cardul `recipe_draft` (o reteta) si `recipe_import` (mai multe, din document).
 */
export function RecipeComponentsEditor({
  rows,
  onChange,
  direction,
  options,
  busy,
  labelPrefix = "",
}: {
  rows: ComponentRow[];
  onChange: (rows: ComponentRow[]) => void;
  direction: RecipeDirection;
  options: ComponentOption[];
  busy: boolean;
  /** Prefix pentru etichetele accesibile, cand sunt mai multe editoare pe pagina. */
  labelPrefix?: string;
}) {
  const parsed = parseComponentRows(rows);
  const sum = sumPercentages(parsed.filter((row) => Number.isFinite(row.percentage)));
  const unitOf = (itemId: string) => options.find((option) => option.id === itemId)?.unit ?? "";
  const nextKey = rows.reduce((max, row) => Math.max(max, row.key), -1) + 1;

  function update(key: number, patch: Partial<ComponentRow>) {
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>{DIRECTION_COMPONENT_ROLE[direction]}</Label>
        <Badge variant={isPercentageSumComplete(sum) ? "ok" : "warn"}>Total {sum}%</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{DIRECTION_PERCENTAGE_HINTS[direction]}</p>
      {rows.map((row, index) => (
        <div key={row.key} className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label={`${labelPrefix}Materia primă ${index + 1}`}
              className={`${selectClassName} min-w-0 flex-1`}
              value={row.itemId}
              onChange={(event) => update(row.key, { itemId: event.target.value })}
            >
              <option value="">Alege materialul</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.title} ({option.unit})
                </option>
              ))}
            </select>
            <Input
              aria-label={`${labelPrefix}Procent ${index + 1}`}
              className="w-24"
              inputMode="decimal"
              value={row.percentage}
              onChange={(event) => update(row.key, { percentage: event.target.value })}
            />
            <span className="w-16 text-sm text-muted-foreground">% {unitOf(row.itemId)}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
            >
              Șterge
            </Button>
          </div>
          {row.sourceName && !row.itemId ? (
            <p className="text-xs text-warn">
              În document: „{row.sourceName}” - nu am găsit materialul, alege-l din listă.
            </p>
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => onChange([...rows, { key: nextKey, itemId: "", percentage: "" }])}
      >
        Adaugă materie primă
      </Button>
    </div>
  );
}
