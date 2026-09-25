"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DIRECTION_SHORT_LABELS, DIRECTION_OPTIONS } from "@/features/recipes/labels";
import type { RecipeDirection } from "@/features/recipes/types";
import {
  componentRowsValid,
  parseComponentRows,
  RecipeComponentsEditor,
  selectClassName,
  toComponentRows,
  type ComponentRow,
} from "./recipe-components-editor";
import type { RecipeImportPresentation } from "./tools/presentation-types";
import type { PendingAction } from "./types";

interface RecipeState {
  sourceName: string;
  itemId: string;
  direction: RecipeDirection;
  included: boolean;
  rows: ComponentRow[];
}

/** Ce impiedica importul unei retete bifate (afisat pe card), sau `null`. */
export function recipeProblem(
  recipe: RecipeState,
  itemsWithRecipe: Set<string>,
  duplicates: Set<string>,
): string | null {
  if (!recipe.itemId) return "Alege produsul.";
  if (itemsWithRecipe.has(recipe.itemId)) return "Produsul are deja o rețetă - debifează-l.";
  if (duplicates.has(recipe.itemId)) return "Același produs apare de două ori în import.";
  if (!componentRowsValid(recipe.rows)) return "Alege materialul și procentul pentru fiecare rând.";
  return null;
}

/**
 * Cardul `recipe_import`: toate retetele gasite intr-un document, fiecare cu produsul,
 * metoda si materiile prime potrivite automat (editabile), plus o bifa „importă”.
 * O singura confirmare pentru tot - `importa_retete` le creeaza pe rand si raporteaza
 * ce a sarit.
 */
export function RecipeImportCard({
  action,
  presentation,
  busy,
  onConfirm,
  onReject,
}: {
  action: PendingAction;
  presentation: RecipeImportPresentation;
  busy: boolean;
  onConfirm: (overrides: Record<string, unknown>) => void;
  onReject: () => void;
}) {
  const [recipes, setRecipes] = useState<RecipeState[]>(() =>
    presentation.recipes.map((recipe) => ({
      sourceName: recipe.sourceName,
      itemId: recipe.itemId ?? "",
      direction: recipe.direction,
      included: recipe.included,
      rows: toComponentRows(recipe.components),
    })),
  );
  const itemsWithRecipe = new Set(presentation.itemsWithRecipe);
  const chosen = recipes.filter((recipe) => recipe.included && recipe.itemId).map((r) => r.itemId);
  const duplicates = new Set(chosen.filter((id, index) => chosen.indexOf(id) !== index));
  const included = recipes.filter((recipe) => recipe.included);
  const canConfirm =
    included.length > 0 &&
    included.every((recipe) => recipeProblem(recipe, itemsWithRecipe, duplicates) === null);

  function update(index: number, patch: Partial<RecipeState>) {
    setRecipes((current) =>
      current.map((recipe, position) => (position === index ? { ...recipe, ...patch } : recipe)),
    );
  }

  function confirm() {
    onConfirm({
      retete: recipes.map((recipe) => ({
        produs: recipe.sourceName,
        item_id: recipe.itemId || undefined,
        directie: recipe.direction,
        inclus: recipe.included,
        componente: parseComponentRows(recipe.rows).map((row, index) => ({
          // Un rand adaugat manual n-are nume din document - folosim denumirea materialului.
          nume:
            recipe.rows[index].sourceName ??
            presentation.itemOptions.find((option) => option.id === row.itemId)?.title ??
            "material",
          item_id: row.itemId || undefined,
          procent: row.percentage,
        })),
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
          <p className="mt-1 text-sm text-muted-foreground">
            {presentation.sourceLabel ? `Din „${presentation.sourceLabel}”. ` : ""}
            Verifică potrivirile cu materialele tale și debifează ce nu vrei să imporți.
          </p>
        </div>

        {recipes.map((recipe, index) => {
          const problem = recipe.included
            ? recipeProblem(recipe, itemsWithRecipe, duplicates)
            : null;
          const prefix = `Rețeta ${index + 1} - `;
          return (
            <section
              key={index}
              aria-label={`Rețeta ${index + 1}: ${recipe.sourceName}`}
              className="space-y-3 rounded-md border p-4"
            >
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={recipe.included}
                  disabled={busy}
                  onChange={(event) => update(index, { included: event.target.checked })}
                />
                Importă „{recipe.sourceName}”
              </label>

              {recipe.included ? (
                <>
                  <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
                    <select
                      aria-label={`${prefix}Produs`}
                      className={selectClassName}
                      value={recipe.itemId}
                      onChange={(event) => update(index, { itemId: event.target.value })}
                    >
                      <option value="">Alege produsul</option>
                      {presentation.itemOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.title} ({option.unit})
                          {itemsWithRecipe.has(option.id) ? " - are deja rețetă" : ""}
                        </option>
                      ))}
                    </select>
                    <select
                      aria-label={`${prefix}Metodă`}
                      className={selectClassName}
                      value={recipe.direction}
                      onChange={(event) =>
                        update(index, { direction: event.target.value as RecipeDirection })
                      }
                    >
                      {DIRECTION_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {DIRECTION_SHORT_LABELS[option]}
                        </option>
                      ))}
                    </select>
                  </div>

                  <RecipeComponentsEditor
                    rows={recipe.rows}
                    onChange={(rows) => update(index, { rows })}
                    direction={recipe.direction}
                    options={presentation.itemOptions.filter(
                      (option) => option.id !== recipe.itemId,
                    )}
                    busy={busy}
                    labelPrefix={prefix}
                  />

                  {problem ? <p className="text-sm text-warn">{problem}</p> : null}
                </>
              ) : null}
            </section>
          );
        })}

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy || !canConfirm} onClick={confirm}>
            Importă {included.length} {included.length === 1 ? "rețetă" : "rețete"}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={onReject}>
            Renunță
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
