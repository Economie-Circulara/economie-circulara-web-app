"use client";

import { useActionState, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { saveQuantityComponentsAction } from "./actions";
import { initialRecipeFormState } from "./action-state";
import { DIRECTION_COMPONENT_ROLE } from "./labels";
import { ProportionBar, type ProportionBarRow } from "./proportion-bar";
import {
  percentagesToQuantities,
  quantitiesToPercentages,
  roundTo,
  scaleQuantities,
  sumPercentages,
} from "./quantity-calc";
import { isPercentageSumComplete } from "./validation";
import type { RecipeDetail, RecipeItemOption } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface Row {
  /** Stabil - id-ul materialului component (unic in lista, `unique(recipe_id, component_item_id)`). */
  key: string;
  componentItemId: string;
  /** Cantitate reala, in UM-ul rețetei (faza 1 - fara conversii de UM aici). */
  quantity: number;
  locked: boolean;
  /** `false` = adaugat in editorul curent, inca nesalvat - poate fi scos din listă direct. */
  existing: boolean;
}

function optionTitle(options: RecipeItemOption[], id: string): string {
  return options.find((o) => o.id === id)?.title ?? id;
}

/**
 * Editor de rețetă in "Cantități reale" (docs/plans/reteta-vizuala.md): utilizatorul
 * stabileste o cantitate de bază in UM-ul rețetei si introduce cantitatea reala a
 * fiecărei materii prime, in ACEEASI UM (faza 1 - fara conversii aici; o componentă
 * cu UM diferită se poate adăuga doar din modul "Procente (avansat)"). Procentele se
 * calculeaza live (`quantity-calc.ts`) si se salveaza EXACT ca azi, prin
 * `saveQuantityComponentsAction` -> `addOrUpdateComponents` (acelasi upsert/validare
 * ca modul clasic).
 */
export function QuantityEditor({
  recipe,
  componentOptions,
}: {
  recipe: RecipeDetail;
  componentOptions: RecipeItemOption[];
}) {
  const [state, action, pending] = useActionState(
    saveQuantityComponentsAction,
    initialRecipeFormState,
  );

  const [batchQty, setBatchQty] = useState(100);
  const [rows, setRows] = useState<Row[]>(() =>
    recipe.components.map((c) => ({
      key: c.componentItemId,
      componentItemId: c.componentItemId,
      quantity: 0, // recalculat mai jos, din procentul salvat + batchQty implicit
      locked: false,
      existing: true,
    })),
  );
  const [newItemId, setNewItemId] = useState("");
  const [calcQty, setCalcQty] = useState<string>("");

  // Cantitatile initiale ale randurilor existente se calculeaza din procentele
  // salvate + batchQty curent - o singura data la montare le-am pus la 0 ca sa nu
  // dublam logica; le derivam mereu, deci starea "sursa" ramane cantitatea introdusa
  // de utilizator din acel moment incolo.
  const savedPercentageByItemId = useMemo(
    () => new Map(recipe.components.map((c) => [c.componentItemId, c.percentage])),
    [recipe.components],
  );

  const effectiveRows = useMemo(() => {
    // Pentru un rand existent care nu a fost inca atins in aceasta sesiune
    // (quantity 0 "implicit"), afisam cantitatea derivata din procentul salvat -
    // asta permite reluarea editarii unei rețete deja completate.
    return rows.map((r) => {
      if (r.existing && r.quantity === 0 && savedPercentageByItemId.has(r.componentItemId)) {
        const pct = savedPercentageByItemId.get(r.componentItemId)!;
        const [derived] = percentagesToQuantities(batchQty, [{ id: r.key, percentage: pct }]);
        return { ...r, quantity: derived?.quantity ?? 0 };
      }
      return r;
    });
  }, [rows, batchQty, savedPercentageByItemId]);

  const percentages = quantitiesToPercentages(
    batchQty,
    effectiveRows.map((r) => ({ id: r.key, quantity: r.quantity })),
  );
  const percentageByKey = new Map(percentages.map((p) => [p.id, p.percentage]));
  const percentageSum = sumPercentages(percentages);

  const usedIds = new Set(effectiveRows.map((r) => r.componentItemId));
  const addableOptions = componentOptions.filter(
    (o) => o.id !== recipe.itemId && !usedIds.has(o.id),
  );

  function updateQuantity(key: string, value: string) {
    const parsed = value.trim() === "" ? 0 : Number(value.replace(",", "."));
    setRows((prev) =>
      prev.map((r) =>
        r.key === key ? { ...r, quantity: Number.isFinite(parsed) ? parsed : 0 } : r,
      ),
    );
  }

  function toggleLock(key: string) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, locked: !r.locked } : r)));
  }

  function removeRow(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  function addRow() {
    if (!newItemId) return;
    setRows((prev) => [
      ...prev,
      { key: newItemId, componentItemId: newItemId, quantity: 0, locked: false, existing: false },
    ]);
    setNewItemId("");
  }

  function handleBarChange(next: ProportionBarRow[]) {
    const nextQuantities = percentagesToQuantities(
      batchQty,
      next.map((n) => ({ id: n.id, percentage: n.percentage })),
    );
    setRows((prev) =>
      prev.map((r) => {
        const q = nextQuantities.find((x) => x.id === r.key);
        return q ? { ...r, quantity: q.quantity } : r;
      }),
    );
  }

  const barRows: ProportionBarRow[] = effectiveRows.map((r) => ({
    id: r.key,
    label: optionTitle(componentOptions, r.componentItemId),
    percentage: percentageByKey.get(r.key) ?? 0,
    locked: r.locked,
  }));

  const previewParts = effectiveRows.map(
    (r) =>
      `${roundTo(r.quantity, 3)} ${recipe.unit} ${optionTitle(componentOptions, r.componentItemId)}`,
  );
  const previewText =
    previewParts.length > 0
      ? `Pentru ${roundTo(batchQty, 3)} ${recipe.unit}: ${previewParts.join(", ")}`
      : "";

  const calcQtyNumber = calcQty.trim() === "" ? null : Number(calcQty.replace(",", "."));
  const calcResults =
    calcQtyNumber !== null && Number.isFinite(calcQtyNumber) && calcQtyNumber > 0
      ? scaleQuantities(calcQtyNumber, percentages).map((q, i) => ({
          title: optionTitle(componentOptions, effectiveRows[i]?.componentItemId ?? ""),
          quantity: q.quantity,
        }))
      : null;

  const rowsJson = JSON.stringify(
    effectiveRows
      .filter((r) => r.componentItemId)
      .map((r) => ({ componentItemId: r.componentItemId, quantity: r.quantity })),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{DIRECTION_COMPONENT_ROLE[recipe.direction]} - cantități reale</CardTitle>
        <CardDescription>
          Setează cantitatea de bază, apoi cantitatea reală a fiecărei materii prime, în aceeași
          unitate de măsură ({recipe.unit}) - procentele se calculează automat. Pentru materiale în
          altă unitate de măsură, folosește tab-ul „Procente (avansat)”.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <form action={action} className="space-y-6">
          <input type="hidden" name="recipe_id" value={recipe.recipeId} />
          <input type="hidden" name="item_id" value={recipe.itemId} />
          <input type="hidden" name="batch_qty" value={batchQty} />
          <input type="hidden" name="rows_json" value={rowsJson} />

          <FormField
            label={`Cantitate de bază (${recipe.unit})`}
            hint="Cantitatea pentru care introduci cantitățile reale de mai jos (ex: 1000, pentru 1000 kg)."
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                min="0"
                step="0.001"
                value={batchQty}
                onChange={(e) => setBatchQty(Number(e.target.value) || 0)}
                className="w-40"
              />
            )}
          </FormField>

          {effectiveRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Adaugă mai jos prima materie primă cu cantitatea ei reală.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {effectiveRows.map((row) => (
                <li key={row.key} className="flex flex-wrap items-center gap-3 px-4 py-2">
                  <span className="min-w-40 flex-1">
                    {optionTitle(componentOptions, row.componentItemId)}
                  </span>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      step="0.001"
                      value={row.quantity}
                      onChange={(e) => updateQuantity(row.key, e.target.value)}
                      className="w-28"
                      aria-label={`Cantitate ${optionTitle(componentOptions, row.componentItemId)}`}
                    />
                    <span className="text-sm text-muted-foreground">{recipe.unit}</span>
                  </div>
                  <Badge variant="info" className="font-mono tabular-nums">
                    {roundTo(percentageByKey.get(row.key) ?? 0, 2)}%
                  </Badge>
                  {!row.existing ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(row.key)}
                      aria-label={`Scoate ${optionTitle(componentOptions, row.componentItemId)}`}
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap items-end gap-3">
            <FormField label="Adaugă materie primă" className="min-w-64">
              {(id) => (
                <select
                  id={id}
                  value={newItemId}
                  onChange={(e) => setNewItemId(e.target.value)}
                  className={selectClassName}
                >
                  <option value="">Alege un material...</option>
                  {addableOptions.map((option) => {
                    const disabled = option.unit !== recipe.unit;
                    return (
                      <option key={option.id} value={option.id} disabled={disabled}>
                        {option.title} ({option.unit})
                        {disabled ? " - UM diferă, folosește modul avansat" : ""}
                      </option>
                    );
                  })}
                </select>
              )}
            </FormField>
            <Button type="button" variant="outline" onClick={addRow} disabled={!newItemId}>
              Adaugă
            </Button>
          </div>

          {effectiveRows.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">Suma procentelor:</span>
                <Badge variant={isPercentageSumComplete(percentageSum) ? "ok" : "warn"}>
                  {roundTo(percentageSum, 2)}%
                </Badge>
              </div>
              <ProportionBar rows={barRows} onChange={handleBarChange} onToggleLock={toggleLock} />
            </div>
          ) : null}

          {previewText ? <p className="text-sm text-muted-foreground">{previewText}</p> : null}

          {state.error ? <p className="text-sm text-danger">{state.error}</p> : null}

          <Button type="submit" disabled={pending || effectiveRows.length === 0}>
            {pending ? "Se salvează..." : "Salvează rețeta"}
          </Button>
        </form>

        <div className="space-y-2 border-t pt-4">
          <FormField
            label={`Calculator - pentru ce cantitate (${recipe.unit})?`}
            hint="Previzualizare - nu modifică rețeta salvată."
          >
            {(id) => (
              <Input
                id={id}
                type="number"
                min="0"
                step="0.001"
                value={calcQty}
                onChange={(e) => setCalcQty(e.target.value)}
                className="w-40"
              />
            )}
          </FormField>
          {calcResults ? (
            <p className="text-sm text-muted-foreground">
              Pentru {roundTo(calcQtyNumber ?? 0, 3)} {recipe.unit}:{" "}
              {calcResults
                .map((r) => `${roundTo(r.quantity, 3)} ${recipe.unit} ${r.title}`)
                .join(", ")}
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
