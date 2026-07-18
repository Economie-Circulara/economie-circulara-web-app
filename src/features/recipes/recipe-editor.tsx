"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { addComponentAction, initialRecipeFormState, removeComponentAction } from "./actions";
import { isPercentageSumComplete } from "./validation";
import type { RecipeDetail, RecipeItemOption } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none " +
  "focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

function RemoveComponentButton({ componentId, itemId }: { componentId: string; itemId: string }) {
  const [state, action, pending] = useActionState(removeComponentAction, initialRecipeFormState);

  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="component_id" value={componentId} />
      <input type="hidden" name="item_id" value={itemId} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label="Șterge componenta"
      >
        <Trash2 className="size-4" />
      </Button>
      {state.error ? <span className="text-xs text-danger">{state.error}</span> : null}
    </form>
  );
}

/**
 * Editor de rețetă: lista componentelor + formular adaugare/actualizare + suma
 * procentelor (INFORMATIVA — nu blocheaza salvarea daca difera de 100%, regula din
 * handoff/AGENTS.md).
 */
export function RecipeEditor({
  recipe,
  componentOptions,
}: {
  recipe: RecipeDetail;
  componentOptions: RecipeItemOption[];
}) {
  const [state, action, pending] = useActionState(addComponentAction, initialRecipeFormState);
  const sumComplete = isPercentageSumComplete(recipe.percentageSum);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Componente</CardTitle>
          <CardDescription>
            Procentele sunt informative — reteta se poate salva chiar daca suma nu e 100%.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Suma procentelor:</span>
            <Badge variant={sumComplete ? "ok" : "warn"}>{recipe.percentageSum}%</Badge>
            {!sumComplete ? (
              <span className="text-xs text-warn">
                Diferă de 100% — verifică rețeta (nu blochează salvarea).
              </span>
            ) : null}
          </div>

          {recipe.components.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nicio componentă adăugată încă.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {recipe.components.map((component) => (
                <li
                  key={component.id}
                  className="flex items-center justify-between gap-3 px-4 py-2"
                >
                  <span>{component.componentItemTitle}</span>
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

      <Card>
        <CardHeader>
          <CardTitle>Adaugă componentă</CardTitle>
          <CardDescription>
            Alegerea unui item deja prezent în rețetă îi actualizează procentul.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={action} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="recipe_id" value={recipe.recipeId} />
            <input type="hidden" name="item_id" value={recipe.itemId} />
            <FormField label="Item" required>
              {(id) => (
                <select
                  id={id}
                  name="component_item_id"
                  required
                  defaultValue=""
                  className={selectClassName}
                >
                  <option value="" disabled>
                    Alege un item...
                  </option>
                  {componentOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.title} ({option.unit})
                    </option>
                  ))}
                </select>
              )}
            </FormField>
            <FormField label="Procent" required>
              {(id) => (
                <Input
                  id={id}
                  name="percentage"
                  type="number"
                  min="0"
                  max="100"
                  step="0.001"
                  required
                  className="w-28"
                />
              )}
            </FormField>
            <Button type="submit" disabled={pending}>
              {pending ? "Se salvează..." : "Adaugă"}
            </Button>
          </form>
          {state.error ? <p className="mt-2 text-sm text-danger">{state.error}</p> : null}
        </CardContent>
      </Card>
    </div>
  );
}
