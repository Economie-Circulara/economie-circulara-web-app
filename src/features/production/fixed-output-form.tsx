"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import { DIRECTION_SHORT_LABELS } from "@/features/recipes/labels";
import type { RecipeDetail, RecipeListRow } from "@/features/recipes/types";
import type { FifoAllocation } from "@/features/stock/service";
import { confirmProcessAction, getFifoPreview, getRecipeForItem } from "./actions";
import { computeRequiredConsumption, sumQtyInRecipeUnit } from "./calc";
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
  /** Aceeasi cantitate in UM-ul produsului (reteta) - singura comparabila intre linii. */
  qtyInRecipeUnit: number;
  /** `items.is_tracked` - itemii nelimitati (apa, aer) nu se consuma din stoc (0029). */
  isTracked: boolean;
  allocation: FifoAllocation[];
  availableQty: number;
  error: string | null;
}

interface FifoResult {
  allocation: FifoAllocation[];
  availableQty: number;
  error: string | null;
}

export interface FixedOutputFormProps {
  recipes: RecipeListRow[];
  recipeItemId: string;
  onRecipeItemIdChange: (itemId: string) => void;
  /** Deschide acelasi item in fluxul 4b (cand rețeta lui e de descompunere). */
  onOpenInVariableFlow: (itemId: string) => void;
}

/**
 * 4a - Output fix (fabricație): alegi rețeta/produsul + cantitatea de output
 * dorită, sistemul calculează automat consumul FIFO pe fiecare componentă,
 * convertit in UM-ul propriu al componentei (`conversion_factor`, migrarea 0028).
 *
 * Fluxul are sens DOAR pentru rețete de `compunere` (itemul rețetei = output,
 * componentele = input). Daca rețeta aleasa e de `descompunere`, formularul NU
 * calculeaza nimic (ar inversa input-ul cu output-ul) si trimite utilizatorul in
 * fluxul 4b.
 */
export function FixedOutputForm({
  recipes,
  recipeItemId,
  onRecipeItemIdChange,
  onOpenInVariableFlow,
}: FixedOutputFormProps) {
  const [qty, setQty] = useState("");
  const [kind, setKind] = useState<ProductionKind>("productie");
  const [components, setComponents] = useState<RecipeDetail | null>(null);
  const [fifoResults, setFifoResults] = useState<Record<string, FifoResult>>({});
  // Cheia `requiredLinesKey` pentru care `fifoResults` e valid - cat timp difera
  // de cheia curenta, preview-ul e "in curs de calcul" (derivat, fara state
  // separat setat sincron in efect - vezi nota de mai jos).
  const [fifoResultsKey, setFifoResultsKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedRecipe = recipes.find((r) => r.itemId === recipeItemId) ?? null;
  const desiredQty = Number(qty.replace(",", "."));
  // Directia vine din reteta (DB), nu din tab-ul deschis - vezi process-wizard.tsx.
  const directionMismatch = selectedRecipe?.direction === "descompunere";

  useEffect(() => {
    if (!recipeItemId) return;
    getRecipeForItem(recipeItemId).then(setComponents);
  }, [recipeItemId]);

  const requiredLines = useMemo(() => {
    if (!components || components.direction !== "compunere") return [];
    if (!Number.isFinite(desiredQty) || desiredQty <= 0) return [];
    try {
      return computeRequiredConsumption(components.components, desiredQty);
    } catch {
      return [];
    }
  }, [components, desiredQty]);

  // Doar componentele urmarite in stoc ajung la preview-ul FIFO: un item
  // `is_tracked = false` (apa, aer) nu are loturi, iar `consume_fifo` ar raporta
  // "stoc insuficient" - exact ce sare si RPC-ul la confirmare (migrarea 0029).
  const trackedLines = useMemo(() => requiredLines.filter((l) => l.isTracked), [requiredLines]);
  const trackedLinesKey = useMemo(() => JSON.stringify(trackedLines), [trackedLines]);

  // Preview-ul FIFO se calculeaza server-side (planFifoConsumption ruleaza in
  // stock/service.ts, cu acces la loturile din DB) - aici doar il combinam cu
  // `requiredLines` (derivat sincron din reteta + cantitate, vezi mai sus), fara
  // sa mai tinem un state separat "preview" care ar trebui resetat manual la
  // fiecare schimbare (evitam setState sincron in corpul efectului - singurele
  // apeluri de setState de mai jos sunt in interiorul `.then()`, dupa fetch).
  useEffect(() => {
    if (trackedLines.length === 0) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      getFifoPreview(trackedLines.map((l) => ({ itemId: l.itemId, qty: l.qty }))).then(
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
          setFifoResultsKey(trackedLinesKey);
        },
      );
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- trackedLines e derivat, comparam continutul prin trackedLinesKey
  }, [trackedLinesKey]);

  const loadingPreview = trackedLines.length > 0 && fifoResultsKey !== trackedLinesKey;

  const preview: PreviewLine[] = useMemo(
    () =>
      requiredLines.map((line) => {
        const result = line.isTracked ? fifoResults[line.itemId] : undefined;
        return {
          itemId: line.itemId,
          itemTitle: line.itemTitle,
          unit: line.unit,
          qty: line.qty,
          qtyInRecipeUnit: line.qtyInRecipeUnit,
          isTracked: line.isTracked,
          allocation: result?.allocation ?? [],
          availableQty: result?.availableQty ?? 0,
          error: result?.error ?? null,
        };
      }),
    [requiredLines, fifoResults],
  );

  const hasErrors = preview.some((p) => p.error);
  // Totalul de intrare se insumeaza in UM-ul produsului (conversie aplicata),
  // altfel s-ar aduna kg cu litri si mc - migrarea 0028.
  const totalIn = sumQtyInRecipeUnit(preview);
  const canConfirm =
    Boolean(selectedRecipe) &&
    !directionMismatch &&
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
          baseQuantity: p.qtyInRecipeUnit,
        })),
        outputs:
          selectedRecipe && desiredQty > 0 && !directionMismatch
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
    [preview, selectedRecipe, desiredQty, directionMismatch],
  );

  function onConfirm() {
    if (!selectedRecipe || !canConfirm) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmProcessAction({
        type: "output_fixed",
        outputItemId: selectedRecipe.itemId,
        recipeId: selectedRecipe.recipeId,
        // Itemii nelimitati se trimit oricum (documenteaza reteta folosita), dar
        // RPC-ul `confirm_process` ii sare la consum - migrarea 0029.
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
        <FormField
          label="Rețetă / produs"
          required
          hint={
            selectedRecipe
              ? `Direcție: ${DIRECTION_SHORT_LABELS[selectedRecipe.direction]}`
              : undefined
          }
        >
          {(id) => (
            <select
              id={id}
              className={selectClassName}
              value={recipeItemId}
              onChange={(e) => onRecipeItemIdChange(e.target.value)}
            >
              {recipes.length === 0 ? <option value="">Nicio rețetă definită</option> : null}
              {recipes.map((r) => (
                <option key={r.itemId} value={r.itemId}>
                  {r.itemTitle} ({DIRECTION_SHORT_LABELS[r.direction]})
                </option>
              ))}
            </select>
          )}
        </FormField>

        {directionMismatch && selectedRecipe ? (
          <div className="space-y-2 rounded-md border border-warn bg-warn/10 px-3 py-2 text-sm">
            <p className="text-warn">
              Rețeta &quot;{selectedRecipe.itemTitle}&quot; este de <strong>descompunere</strong>:
              itemul ei este materialul de INTRARE, iar componentele sunt fracțiile REZULTATE.
              Fabricația cu output fix ar inversa fluxul, așa că nu calculăm nimic aici.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenInVariableFlow(selectedRecipe.itemId)}
            >
              Deschide în &quot;Output variabil - Reciclare&quot; {"->"}
            </Button>
          </div>
        ) : null}

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
              disabled={directionMismatch}
            />
          )}
        </FormField>

        <div className="rounded-lg border bg-secondary/40 p-4">
          <div className="mb-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            Consum calculat (FIFO)
          </div>
          {loadingPreview ? (
            <p className="text-sm text-muted-foreground">Se calculează...</p>
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
                    {line.isTracked ? (
                      <>
                        <span>{line.allocation.length} lot(uri)</span>
                        <span>disponibil {line.availableQty}</span>
                      </>
                    ) : (
                      <span>nelimitat - nu se consumă din stoc</span>
                    )}
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
            {"loturi -> proces -> output"}
          </span>
        </div>
        <div className="flex min-h-[240px] flex-1 items-center">
          <SankeyDiagram data={sankeyData} />
        </div>
        <div className="flex items-center justify-between gap-4 border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Total intrare{" "}
            <span className="font-medium tabular-nums text-foreground">{totalIn}</span>{" "}
            {selectedRecipe?.unit} {"->"}{" "}
            <span className="font-medium text-foreground">
              {desiredQty > 0 ? desiredQty : 0} {selectedRecipe?.unit}
            </span>{" "}
            {selectedRecipe?.itemTitle}
          </p>
          <Button onClick={onConfirm} disabled={!canConfirm || isPending}>
            {isPending ? "Se confirmă..." : "Confirmă și pornește ->"}
          </Button>
        </div>
      </div>
    </div>
  );
}
