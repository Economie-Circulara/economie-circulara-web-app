"use client";

import { useActionState, useState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { addComponentAction, removeComponentAction, updateRecipeDirectionAction } from "./actions";
import { initialRecipeFormState } from "./action-state";
import {
  DIRECTION_COMPONENT_ROLE,
  DIRECTION_DESCRIPTIONS,
  DIRECTION_LABELS,
  DIRECTION_OPTIONS,
  DIRECTION_PERCENTAGE_HINTS,
  DIRECTION_SHORT_LABELS,
} from "./labels";
import { AiExtractTab } from "./ai-extract-tab";
import { QuantityEditor, type QuantityDraft } from "./quantity-editor";
import { isPercentageSumComplete } from "./validation";
import type { RecipeDetail, RecipeDirection, RecipeItemOption } from "./types";

type EditorMode = "cantitati" | "procente" | "ai";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function RemoveComponentButton({ componentId, itemId }: { componentId: string; itemId: string }) {
  const [state, action, pending] = useActionState(removeComponentAction, initialRecipeFormState);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="component_id" value={componentId} />
      <input type="hidden" name="item_id" value={itemId} />
      <Button type="submit" variant="ghost" size="icon" disabled={pending} aria-label="Șterge">
        <Trash2 className="size-4" />
      </Button>
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}

/**
 * Selectorul de metoda al unei retete EXISTENTE. Schimbarea e permisa (retetele
 * nu au versionare - AGENTS.md §4), dar rastoarna semantica tuturor componentelor
 * deja definite (materie prima <-> material rezultat), de-aici avertismentul afisat
 * inainte de submit.
 */
function DirectionCard({ recipe }: { recipe: RecipeDetail }) {
  const [state, action, pending] = useActionState(
    updateRecipeDirectionAction,
    initialRecipeFormState,
  );
  const [direction, setDirection] = useState<RecipeDirection>(recipe.direction);
  const changed = direction !== recipe.direction;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Metoda rețetei
          <Badge variant="info">{DIRECTION_SHORT_LABELS[recipe.direction]}</Badge>
        </CardTitle>
        <CardDescription>{DIRECTION_DESCRIPTIONS[recipe.direction]}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="recipe_id" value={recipe.recipeId} />
          <input type="hidden" name="item_id" value={recipe.itemId} />
          <FormField label="Metodă" required>
            {(id) => (
              <select
                id={id}
                name="direction"
                value={direction}
                onChange={(e) => setDirection(e.target.value as RecipeDirection)}
                className={selectClassName + " sm:w-96"}
              >
                {DIRECTION_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {DIRECTION_LABELS[option]}
                  </option>
                ))}
              </select>
            )}
          </FormField>
          <Button type="submit" variant="outline" disabled={pending || !changed}>
            {pending ? "Se salvează..." : "Schimbă metoda"}
          </Button>
        </form>
        {changed ? (
          <p className="mt-2 text-sm text-warn">
            Atenție: schimbarea metodei inversează sensul tuturor componentelor deja definite - cele{" "}
            {recipe.direction === "compunere" ? "consumate" : "produse"} devin{" "}
            {recipe.direction === "compunere" ? "produse" : "consumate"}. Verifică procentele și
            factorii de conversie după salvare.
          </p>
        ) : null}
        {state.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
      </CardContent>
    </Card>
  );
}

/**
 * Editor de rețetă: metoda (compunere/descompunere - migrarea 0028), lista
 * componentelor cu factorul de conversie de UM, formular adaugare/actualizare si
 * suma procentelor (INFORMATIVA - nu blocheaza salvarea daca difera de 100%,
 * regula din handoff/AGENTS.md).
 */
export function RecipeEditor({
  recipe,
  componentOptions,
  aiExtractionAvailable = false,
}: {
  recipe: RecipeDetail;
  componentOptions: RecipeItemOption[];
  /** `isChatProviderConfigured()` - vezi docs/plans/reteta-ai.md. */
  aiExtractionAvailable?: boolean;
}) {
  const [state, action, pending] = useActionState(addComponentAction, initialRecipeFormState);
  const [componentItemId, setComponentItemId] = useState("");
  const [mode, setMode] = useState<EditorMode>("cantitati");
  const [draft, setDraft] = useState<QuantityDraft | null>(null);
  const [draftVersion, setDraftVersion] = useState(0);
  const sumComplete = isPercentageSumComplete(recipe.percentageSum);

  function applyDraft(nextDraft: QuantityDraft) {
    setDraft(nextDraft);
    setDraftVersion((v) => v + 1);
    setMode("cantitati");
  }

  const selectedOption = componentOptions.find((option) => option.id === componentItemId) ?? null;
  const unitsDiffer = Boolean(selectedOption) && selectedOption!.unit !== recipe.unit;

  return (
    <div className="space-y-6">
      <DirectionCard recipe={recipe} />

      <Card>
        <CardHeader>
          <CardTitle>{DIRECTION_COMPONENT_ROLE[recipe.direction]}</CardTitle>
          <CardDescription>
            Procentele sunt informative - reteta se poate salva chiar daca suma nu e 100%.
            Cantitățile se calculează în unitatea de măsură a fiecărei materii prime, prin factorul
            de conversie.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Suma procentelor:</span>
            <Badge variant={sumComplete ? "ok" : "warn"}>{recipe.percentageSum}%</Badge>
            {!sumComplete ? (
              <span className="text-xs text-warn">
                Diferă de 100% - verifică rețeta (nu blochează salvarea).
              </span>
            ) : null}
          </div>

          {recipe.components.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {recipe.direction === "compunere"
                ? "Nicio materie primă adăugată încă."
                : "Niciun material rezultat adăugat încă."}
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {recipe.components.map((component) => (
                <li
                  key={component.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-2"
                >
                  <div>
                    <span>{component.componentItemTitle}</span>
                    <div className="text-xs text-muted-foreground">
                      {component.unit === recipe.unit ? (
                        <>Aceeași unitate de măsură ({component.unit})</>
                      ) : (
                        <>
                          1 {component.unit} = {component.conversionFactor} {recipe.unit}
                        </>
                      )}
                      {component.isTracked ? null : " · nelimitat (fără stoc)"}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm tabular-nums">{component.percentage}%</span>
                    <RemoveComponentButton componentId={component.id} itemId={recipe.itemId} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div
        role="tablist"
        aria-label="Mod de introducere a rețetei"
        className="flex flex-wrap gap-2 border-b"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "cantitati"}
          onClick={() => setMode("cantitati")}
          className={
            "rounded-t-md px-3 py-2 text-sm font-medium " +
            (mode === "cantitati"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Cantități reale
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "procente"}
          onClick={() => setMode("procente")}
          className={
            "rounded-t-md px-3 py-2 text-sm font-medium " +
            (mode === "procente"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Procente (avansat)
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "ai"}
          onClick={() => setMode("ai")}
          className={
            "rounded-t-md px-3 py-2 text-sm font-medium " +
            (mode === "ai"
              ? "border-b-2 border-primary text-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          Din text (AI)
        </button>
      </div>

      {mode === "cantitati" ? (
        <QuantityEditor
          key={draftVersion}
          recipe={recipe}
          componentOptions={componentOptions}
          initialDraft={draft ?? undefined}
        />
      ) : mode === "ai" ? (
        <AiExtractTab
          itemId={recipe.itemId}
          recipeUnit={recipe.unit}
          providerConfigured={aiExtractionAvailable}
          onApplyDraft={applyDraft}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              {recipe.direction === "compunere"
                ? "Adaugă materie primă"
                : "Adaugă material rezultat"}
            </CardTitle>
            <CardDescription>
              Alegerea unui material deja prezent în rețetă îi actualizează procentul și factorul.
              Modul avansat - permite conversii intre unități de măsură diferite.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={action} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="recipe_id" value={recipe.recipeId} />
              <input type="hidden" name="item_id" value={recipe.itemId} />
              <FormField label="Material" required>
                {(id) => (
                  <select
                    id={id}
                    name="component_item_id"
                    required
                    value={componentItemId}
                    onChange={(e) => setComponentItemId(e.target.value)}
                    className={selectClassName}
                  >
                    <option value="" disabled>
                      Alege un material...
                    </option>
                    {componentOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.title} ({option.unit})
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
              <FormField
                label="Procent"
                required
                hint={DIRECTION_PERCENTAGE_HINTS[recipe.direction]}
              >
                {(id) => (
                  <Input
                    id={id}
                    name="percentage"
                    type="number"
                    min="0"
                    step="0.001"
                    required
                    className="w-28"
                  />
                )}
              </FormField>
              <FormField
                label={
                  selectedOption
                    ? `Câte ${recipe.unit} are un ${selectedOption.unit}?`
                    : "Câte unități de rețetă are o unitate de materie primă?"
                }
                required={unitsDiffer}
                hint={
                  selectedOption
                    ? unitsDiffer
                      ? "Obligatoriu, unitățile de măsură diferă (ex: 1 mc nisip = 1500 kg beton)."
                      : "Unități de măsură identice, lasă 1."
                    : "Implicit 1, dacă nu se completează."
                }
              >
                {(id) => (
                  <Input
                    id={id}
                    name="conversion_factor"
                    type="number"
                    min="0"
                    step="0.000001"
                    defaultValue="1"
                    key={componentItemId}
                    className={unitsDiffer ? "w-36 border-warn" : "w-36"}
                  />
                )}
              </FormField>
              <Button type="submit" disabled={pending}>
                {pending ? "Se salvează..." : "Adaugă"}
              </Button>
            </form>
            {unitsDiffer ? (
              <p className="mt-2 text-sm text-warn">
                Unitatea de măsură a materiei prime ({selectedOption!.unit}) diferă de unitatea de
                măsură a produsului ({recipe.unit}). Fără un factor corect, cantitățile calculate la
                producție vor fi greșite.
              </p>
            ) : null}
            {state.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
