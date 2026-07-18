"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import type { RecipeDetail, RecipeListRow } from "@/features/recipes/types";
import type { FifoAllocation } from "@/features/stock/service";
import { confirmProcessAction, getFifoPreview, getRecipeForItem } from "./actions";
import { computeRequiredConsumption, sumQty } from "./calc";
import { SankeyDiagram } from "./sankey-diagram";
import { buildProcessSankeyData } from "./sankey-data";
import { PRODUCTION_KIND_LABELS, PRODUCTION_KIND_OPTIONS } from "./labels";
import { PRODUCTION_KIND_TO_PROVENANCE } from "./types";
import type { ProductionKind, UnitOfMeasure } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none";

interface PreviewLine {
  itemId: string;
  itemTitle: string;
  unit: UnitOfMeasure;
  qty: number;
  allocation: FifoAllocation[];
  availableQty: number;
  error: string | null;
}

interface FifoResult {
  allocation: FifoAllocation[];
  availableQty: number;
  error: string | null;
}

/**
 * 4a — Output fix (fabricație): alegi rețeta/produsul + cantitatea de output
 * dorită, sistemul calculează automat consumul FIFO pe fiecare componentă.
 */
export function FixedOutputForm({ recipes }: { recipes: RecipeListRow[] }) {
  const [recipeItemId, setRecipeItemId] = useState(recipes[0]?.itemId ?? "");
  const [qty, setQty] = useState("");
  const [kind, setKind] = useState<ProductionKind>("productie");
  const [components, setComponents] = useState<RecipeDetail | null>(null);
  const [fifoResults, setFifoResults] = useState<Record<string, FifoResult>>({});
  // Cheia `requiredLinesKey` pentru care `fifoResults` e valid — cat timp difera
  // de cheia curenta, preview-ul e "in curs de calcul" (derivat, fara state
  // separat setat sincron in efect — vezi nota de mai jos).
  const [fifoResultsKey, setFifoResultsKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedRecipe = recipes.find((r) => r.itemId === recipeItemId) ?? null;
  const desiredQty = Number(qty.replace(",", "."));

  useEffect(() => {
    if (!recipeItemId) return;
    getRecipeForItem(recipeItemId).then(setComponents);
  }, [recipeItemId]);

  const requiredLines = useMemo(() => {
    if (!components || !Number.isFinite(desiredQty) || desiredQty <= 0) return [];
    try {
      return computeRequiredConsumption(components.components, desiredQty);
    } catch {
      return [];
    }
  }, [components, desiredQty]);

  const requiredLinesKey = useMemo(() => JSON.stringify(requiredLines), [requiredLines]);

  // Preview-ul FIFO se calculeaza server-side (planFifoConsumption ruleaza in
  // stock/service.ts, cu acces la loturile din DB) — aici doar il combinam cu
  // `requiredLines` (derivat sincron din reteta + cantitate, vezi mai sus), fara
  // sa mai tinem un state separat "preview" care ar trebui resetat manual la
  // fiecare schimbare (evitam setState sincron in corpul efectului — singurele
  // apeluri de setState de mai jos sunt in interiorul `.then()`, dupa fetch).
  useEffect(() => {
    if (requiredLines.length === 0) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      getFifoPreview(requiredLines.map((l) => ({ itemId: l.itemId, qty: l.qty }))).then(
        (results) => {
          if (cancelled) return;
          const next: Record<string, FifoResult> = {};
          results.forEach((r) => {
            next[r.itemId] = {
              allocation: r.allocation,
              availableQty: r.availableQty,
              error: r.error,
            };
          });
          setFifoResults(next);
          setFifoResultsKey(requiredLinesKey);
        },
      );
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- requiredLines e derivat, comparam continutul prin requiredLinesKey
  }, [requiredLinesKey]);

  const loadingPreview = requiredLines.length > 0 && fifoResultsKey !== requiredLinesKey;

  const preview: PreviewLine[] = useMemo(
    () =>
      requiredLines.map((line) => {
        const result = fifoResults[line.itemId];
        return {
          itemId: line.itemId,
          itemTitle: line.itemTitle,
          unit: line.unit,
          qty: line.qty,
          allocation: result?.allocation ?? [],
          availableQty: result?.availableQty ?? 0,
          error: result?.error ?? null,
        };
      }),
    [requiredLines, fifoResults],
  );

  const hasErrors = preview.some((p) => p.error);
  const totalIn = sumQty(preview.map((p) => ({ qty: p.qty })));
  const canConfirm =
    Boolean(selectedRecipe) &&
    desiredQty > 0 &&
    preview.length > 0 &&
    !hasErrors &&
    !loadingPreview;

  const sankeyData = useMemo(
    () =>
      buildProcessSankeyData({
        inputs: preview.map((p, i) => ({
          lotId: `preview-in-${i}`,
          itemId: p.itemId,
          itemTitle: p.itemTitle,
          unit: p.unit,
          quantity: p.qty,
        })),
        outputs:
          selectedRecipe && desiredQty > 0
            ? [
                {
                  lotId: "preview-out",
                  itemId: selectedRecipe.itemId,
                  itemTitle: selectedRecipe.itemTitle,
                  unit: selectedRecipe.unit,
                  quantity: desiredQty,
                },
              ]
            : [],
      }),
    [preview, selectedRecipe, desiredQty],
  );

  function onConfirm() {
    if (!selectedRecipe || !canConfirm) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmProcessAction({
        type: "output_fixed",
        outputItemId: selectedRecipe.itemId,
        recipeId: selectedRecipe.recipeId,
        inputs: preview.map((p) => ({
          itemId: p.itemId,
          lotIds: p.allocation.map((a) => a.lotId),
          qty: p.qty,
        })),
        outputs: [
          {
            itemId: selectedRecipe.itemId,
            qty: desiredQty,
            provenance: PRODUCTION_KIND_TO_PROVENANCE[kind],
          },
        ],
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-0 rounded-b-lg border border-t-0 bg-card md:grid-cols-[380px_1fr]">
      <div className="space-y-4 border-b p-6 md:border-b-0 md:border-r">
        <FormField label="Rețetă / produs" required>
          {(id) => (
            <select
              id={id}
              className={selectClassName}
              value={recipeItemId}
              onChange={(e) => setRecipeItemId(e.target.value)}
            >
              {recipes.length === 0 ? <option value="">Nicio rețetă definită</option> : null}
              {recipes.map((r) => (
                <option key={r.itemId} value={r.itemId}>
                  {r.itemTitle}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField label="Tip proces" required>
          {(id) => (
            <select
              id={id}
              className={selectClassName}
              value={kind}
              onChange={(e) => setKind(e.target.value as ProductionKind)}
            >
              {PRODUCTION_KIND_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {PRODUCTION_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          )}
        </FormField>

        <FormField
          label="Cantitate output dorită"
          required
          hint={selectedRecipe ? `Unitate: ${selectedRecipe.unit}` : undefined}
        >
          {(id) => (
            <Input
              id={id}
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              placeholder="0"
            />
          )}
        </FormField>

        <div className="rounded-lg border bg-secondary/40 p-4">
          <div className="mb-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            Consum calculat (FIFO)
          </div>
          {loadingPreview ? (
            <p className="text-sm text-muted-foreground">Se calculează…</p>
          ) : preview.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Alege o rețetă și o cantitate pentru a vedea consumul.
            </p>
          ) : (
            <ul className="space-y-2">
              {preview.map((line) => (
                <li key={line.itemId} className="border-t pt-2 first:border-t-0 first:pt-0">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-medium">{line.itemTitle}</span>
                    <span
                      className={
                        "font-mono text-sm tabular-nums " +
                        (line.error ? "text-danger" : "text-foreground")
                      }
                    >
                      {line.qty} {line.unit}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-xs text-muted-foreground">
                    <span>{line.allocation.length} lot(uri)</span>
                    <span>disponibil {line.availableQty}</span>
                  </div>
                  {line.error ? <p className="mt-1 text-xs text-danger">{line.error}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {error ? (
          <div className="rounded-md border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col p-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Flux materiale</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            loturi → proces → output
          </span>
        </div>
        <div className="flex min-h-[240px] flex-1 items-center">
          <SankeyDiagram data={sankeyData} />
        </div>
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Total intrare{" "}
            <span className="font-medium tabular-nums text-foreground">{totalIn}</span> →{" "}
            <span className="font-medium text-foreground">
              {desiredQty > 0 ? desiredQty : 0} {selectedRecipe?.unit}
            </span>{" "}
            {selectedRecipe?.itemTitle}
          </p>
          <Button onClick={onConfirm} disabled={!canConfirm || isPending}>
            {isPending ? "Se confirmă…" : "Confirmă și pornește →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
