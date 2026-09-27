"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { DIRECTION_LABELS, DIRECTION_OPTIONS } from "@/features/recipes/labels";
import type { RecipeDirection } from "@/features/recipes/types";
import {
  componentRowsValid,
  parseComponentRows,
  RecipeComponentsEditor,
  selectClassName,
  toComponentRows,
  type ComponentRow,
} from "./recipe-components-editor";
import type { RecipeDraftPresentation } from "./tools/presentation-types";
import type { PendingAction } from "./types";

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
  const [rows, setRows] = useState<ComponentRow[]>(() =>
    toComponentRows(presentation.draft.components),
  );

  function confirm() {
    onConfirm({
      directie: direction,
      componente: parseComponentRows(rows).map((row) => ({
        item_id: row.itemId,
        procent: row.percentage,
      })),
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

        <RecipeComponentsEditor
          rows={rows}
          onChange={setRows}
          direction={direction}
          options={presentation.componentOptions}
          busy={busy}
        />

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || !componentRowsValid(rows)} onClick={confirm}>
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
