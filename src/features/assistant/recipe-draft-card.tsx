"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DIRECTION_COMPONENT_ROLE,
  DIRECTION_LABELS,
  DIRECTION_OPTIONS,
  DIRECTION_PERCENTAGE_HINTS,
} from "@/features/recipes/labels";
import { isPercentageSumComplete, sumPercentages } from "@/features/recipes/validation";
import type { RecipeDirection } from "@/features/recipes/types";
import type { RecipeDraftPresentation } from "./tools/presentation-types";
import type { PendingAction } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none";

interface Row {
  key: number;
  itemId: string;
  percentage: string;
}

/**
 * Cardul de confirmare pentru `creeaza_reteta`: metoda + lista de materii prime
 * (material + procent) cu add/remove. Starea editata traieste doar aici; la
 * „Confirmă” se trimite un obiect STRUCTURAT (`componente` ca array), la fel ca
 * `OrderDraftCard`. Validarea finala ramane in `tool.parse` (server).
 */
export function RecipeDraftCard({
  action,
  presentation,
  busy,
  onConfirm,
  onReject,
}: {
  action: PendingAction;
  presentation: RecipeDraftPresentation;
  busy: boolean;
  onConfirm: (overrides: Record<string, unknown>) => void;
  onReject: () => void;
}) {
  const [direction, setDirection] = useState<RecipeDirection>(presentation.draft.direction);
  const [rows, setRows] = useState<Row[]>(() =>
    presentation.draft.components.map((component, index) => ({
      key: index,
      itemId: component.itemId,
      percentage: String(component.percentage),
    })),
  );
  const [nextKey, setNextKey] = useState(rows.length);

  const parsed = rows.map((row) => ({
    itemId: row.itemId,
    percentage: Number(row.percentage.replace(",", ".")),
  }));
  const valid =
    parsed.length > 0 &&
    parsed.every((row) => row.itemId && Number.isFinite(row.percentage) && row.percentage > 0);
  const sum = sumPercentages(parsed.filter((row) => Number.isFinite(row.percentage)));
  const unitOf = (itemId: string) =>
    presentation.componentOptions.find((option) => option.id === itemId)?.unit ?? "";

  function update(key: number, patch: Partial<Row>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function confirm() {
    onConfirm({
      directie: direction,
      componente: parsed.map((row) => ({ item_id: row.itemId, procent: row.percentage })),
    });
  }

  return (
    <Card className="border-primary">
      <CardContent className="space-y-4 p-5">
        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Acțiune propusă - neexecutată
          </p>
          <p className="mt-1 font-semibold">{action.summary}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Produs</Label>
            <p className="text-sm text-muted-foreground">
              {presentation.itemTitle}
              {presentation.itemUnit ? ` (${presentation.itemUnit})` : ""}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipe-direction">Metodă</Label>
            <select
              id="recipe-direction"
              className={selectClassName}
              value={direction}
              onChange={(event) => setDirection(event.target.value as RecipeDirection)}
            >
              {DIRECTION_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {DIRECTION_LABELS[option]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label>{DIRECTION_COMPONENT_ROLE[direction]}</Label>
            <Badge variant={isPercentageSumComplete(sum) ? "ok" : "warn"}>Total {sum}%</Badge>
          </div>
          <p className="text-xs text-muted-foreground">{DIRECTION_PERCENTAGE_HINTS[direction]}</p>
          {rows.map((row, index) => (
            <div key={row.key} className="flex flex-wrap items-center gap-2">
              <select
                aria-label={`Materia primă ${index + 1}`}
                className={`${selectClassName} min-w-0 flex-1`}
                value={row.itemId}
                onChange={(event) => update(row.key, { itemId: event.target.value })}
              >
                <option value="">Alege materialul</option>
                {presentation.componentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.title} ({option.unit})
                  </option>
                ))}
              </select>
              <Input
                aria-label={`Procent ${index + 1}`}
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
                onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))}
              >
                Șterge
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => {
              setRows((current) => [...current, { key: nextKey, itemId: "", percentage: "" }]);
              setNextKey((key) => key + 1);
            }}
          >
            Adaugă materie primă
          </Button>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || !valid} onClick={confirm}>
            Confirmă și execută
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onReject}>
            Renunță
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
