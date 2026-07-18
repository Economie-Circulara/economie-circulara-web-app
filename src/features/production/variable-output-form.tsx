"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/form-field";
import type { RecipeDetail } from "@/features/recipes/types";
import type { ItemOption } from "@/features/items/types";
import type { FifoAllocation } from "@/features/stock/service";
import { confirmProcessAction, getFifoPreview, getRecipeForItem } from "./actions";
import { computeIdealOutput, roundQty, sumQty } from "./calc";
import { SankeyDiagram } from "./sankey-diagram";
import { buildProcessSankeyData } from "./sankey-data";
import { PRODUCTION_KIND_LABELS, PRODUCTION_KIND_OPTIONS } from "./labels";
import { PRODUCTION_KIND_TO_PROVENANCE } from "./types";
import type { ProductionKind, UnitOfMeasure } from "./types";

const selectClassName =
  "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs outline-none";

interface OutputRow {
  itemId: string;
  itemTitle: string;
  unit: UnitOfMeasure;
  percentage: number | null;
  idealQty: number | null;
  realQty: string;
}

/**
 * 4b — Input fix / output variabil (reciclare): alegi materialul de input +
 * cantitatea, sistemul afișează outputul ideal (dacă itemul de input are o
 * "rețetă" — interpretata aici ca descompunere in fracții, vezi migrarea 0008),
 * apoi utilizatorul ajustează cantitățile reale intr-un tabel editabil.
 */
export function VariableOutputForm({ inputItems }: { inputItems: ItemOption[] }) {
  const [inputItemId, setInputItemId] = useState(inputItems[0]?.id ?? "");
  const [inputQty, setInputQty] = useState("");
  const [kind, setKind] = useState<ProductionKind>("reciclare");
  const [recipe, setRecipe] = useState<RecipeDetail | null>(null);
  // Editarile utilizatorului pe coloana "Real" (cheie: itemId fractie). Se
  // reseteaza cand se schimba itemul de input (vezi pattern-ul de mai jos —
  // "adjusting state when a prop changes", render-time, nu intr-un efect:
  // https://react.dev/learn/you-might-not-need-an-effect).
  const [realQtyOverrides, setRealQtyOverrides] = useState<Record<string, string>>({});
  const [resetKey, setResetKey] = useState(inputItemId);
  if (inputItemId !== resetKey) {
    setResetKey(inputItemId);
    setRealQtyOverrides({});
  }

  const [fifoResult, setFifoResult] = useState<{
    allocation: FifoAllocation[];
    availableQty: number;
    error: string | null;
  } | null>(null);
  // Cheia (item + cantitate) pentru care `fifoResult` e valid — vezi comentariul
  // din fixed-output-form.tsx pentru motivul evitarii unui `loadingPreview`
  // setat sincron in efect.
  const [fifoResultKey, setFifoResultKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedInput = inputItems.find((i) => i.id === inputItemId) ?? null;
  const qtyNum = Number(inputQty.replace(",", "."));

  useEffect(() => {
    if (!inputItemId) return;
    getRecipeForItem(inputItemId).then(setRecipe);
  }, [inputItemId]);

  // Outputul ideal (fractii) e derivat pur din rețetă + cantitate — nu are
  // nevoie de state/efect propriu.
  const idealLines = useMemo(() => {
    if (!recipe || recipe.components.length === 0 || !Number.isFinite(qtyNum) || qtyNum <= 0)
      return [];
    return computeIdealOutput(recipe.components, qtyNum);
  }, [recipe, qtyNum]);

  const rows: OutputRow[] = useMemo(() => {
    if (!recipe) return [];
    return recipe.components.map((c) => {
      const ideal = idealLines.find((l) => l.itemId === c.componentItemId);
      const override = realQtyOverrides[c.componentItemId];
      return {
        itemId: c.componentItemId,
        itemTitle: c.componentItemTitle,
        unit: c.unit,
        percentage: c.percentage,
        idealQty: ideal?.qty ?? null,
        realQty: override !== undefined ? override : ideal ? String(ideal.qty) : "",
      };
    });
  }, [recipe, idealLines, realQtyOverrides]);

  const inputAllocation = fifoResult?.allocation ?? [];
  const inputAvailable = fifoResult?.availableQty ?? 0;
  const inputError = fifoResult?.error ?? null;
  const previewKey = `${inputItemId}:${qtyNum}`;
  const loadingPreview =
    Boolean(inputItemId) && Number.isFinite(qtyNum) && qtyNum > 0 && fifoResultKey !== previewKey;

  useEffect(() => {
    if (!inputItemId || !Number.isFinite(qtyNum) || qtyNum <= 0) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      getFifoPreview([{ itemId: inputItemId, qty: qtyNum }]).then(([result]) => {
        if (cancelled) return;
        setFifoResult({
          allocation: result?.allocation ?? [],
          availableQty: result?.availableQty ?? 0,
          error: result?.error ?? null,
        });
        setFifoResultKey(previewKey);
      });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- previewKey deriva din inputItemId+qtyNum
  }, [inputItemId, qtyNum]);

  function updateRealQty(itemId: string, value: string) {
    setRealQtyOverrides((prev) => ({ ...prev, [itemId]: value }));
  }

  const parsedRows = useMemo(
    () => rows.map((row) => ({ ...row, realQtyNum: Number(row.realQty.replace(",", ".")) || 0 })),
    [rows],
  );
  const totalReal = sumQty(parsedRows.map((r) => ({ qty: r.realQtyNum })));
  const balance = roundQty(qtyNum - totalReal);

  const canConfirm =
    Boolean(selectedInput) &&
    qtyNum > 0 &&
    !inputError &&
    !loadingPreview &&
    parsedRows.some((r) => r.realQtyNum > 0);

  const sankeyData = useMemo(
    () =>
      buildProcessSankeyData({
        inputs:
          selectedInput && qtyNum > 0
            ? [
                {
                  lotId: "preview-in",
                  itemId: selectedInput.id,
                  itemTitle: selectedInput.title,
                  unit: selectedInput.unit,
                  quantity: qtyNum,
                },
              ]
            : [],
        outputs: parsedRows
          .filter((r) => r.realQtyNum > 0)
          .map((r, i) => ({
            lotId: `preview-out-${i}`,
            itemId: r.itemId,
            itemTitle: r.itemTitle,
            unit: r.unit,
            quantity: r.realQtyNum,
          })),
      }),
    [selectedInput, qtyNum, parsedRows],
  );

  function onConfirm() {
    if (!selectedInput || !canConfirm) return;
    // `processes.output_item_id` e un singur camp (schema) — la 4b, cu output
    // multiplu, folosim prima fracție cu cantitate > 0 ca item "reprezentativ"
    // (informativ; trasabilitatea reala vine din `process_outputs`, cu toate
    // itemii/loturile create).
    const primaryOutput = parsedRows.find((r) => r.realQtyNum > 0);
    if (!primaryOutput) return;
    setError(null);
    startTransition(async () => {
      const result = await confirmProcessAction({
        type: "input_fixed",
        outputItemId: primaryOutput.itemId,
        recipeId: recipe?.recipeId ?? null,
        inputs: [
          { itemId: selectedInput.id, lotIds: inputAllocation.map((a) => a.lotId), qty: qtyNum },
        ],
        outputs: parsedRows
          .filter((r) => r.realQtyNum > 0)
          .map((r) => ({
            itemId: r.itemId,
            qty: r.realQtyNum,
            provenance: PRODUCTION_KIND_TO_PROVENANCE[kind],
          })),
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-0 rounded-b-lg border border-t-0 bg-card md:grid-cols-2">
      <div className="space-y-4 border-b p-6 md:border-r md:border-b-0">
        <FormField label="Material input" required>
          {(id) => (
            <div className="flex gap-2">
              <select
                id={id}
                className={selectClassName}
                value={inputItemId}
                onChange={(e) => setInputItemId(e.target.value)}
              >
                {inputItems.length === 0 ? <option value="">Niciun item</option> : null}
                {inputItems.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.title}
                  </option>
                ))}
              </select>
              <div className="flex w-32 shrink-0 overflow-hidden rounded-md border border-input bg-card">
                <input
                  className="w-full px-3 py-1 text-sm outline-none"
                  inputMode="decimal"
                  value={inputQty}
                  onChange={(e) => setInputQty(e.target.value)}
                  placeholder="0"
                />
                <span className="flex items-center border-l bg-secondary/60 px-2 text-xs text-muted-foreground">
                  {selectedInput?.unit ?? ""}
                </span>
              </div>
            </div>
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

        {inputError ? (
          <div className="rounded-md border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
            {inputError} (disponibil {inputAvailable})
          </div>
        ) : null}

        <div>
          <div className="mb-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            Output real — ajustează fracțiile
          </div>
          {!recipe || recipe.components.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Itemul ales nu are o rețetă/descompunere definită — introdu manual outputul din
              /retete pentru a vedea fracțiile ideale aici.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 font-medium">Fracție</th>
                  <th className="py-1 text-right font-medium">Ideal</th>
                  <th className="py-1 text-right font-medium">Real</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.itemId} className="border-t">
                    <td className="py-2">
                      <div className="font-medium">{row.itemTitle}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.percentage}% teoretic
                      </div>
                    </td>
                    <td className="py-2 text-right text-muted-foreground tabular-nums">
                      {row.idealQty ?? "—"}
                    </td>
                    <td className="py-2 text-right">
                      <Input
                        value={row.realQty}
                        onChange={(e) => updateRealQty(row.itemId, e.target.value)}
                        className="ml-auto w-24 text-right tabular-nums"
                        inputMode="decimal"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-3 flex items-center justify-between rounded-md bg-secondary/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              Total output{" "}
              <span className="font-medium tabular-nums text-foreground">{totalReal}</span>
            </span>
            <span className={"font-semibold " + (balance === 0 ? "text-ok" : "text-warn")}>
              Balanță {balance}
            </span>
          </div>
        </div>

        {error ? (
          <div className="rounded-md border border-danger bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col p-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Flux reciclare</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            input → proces → fracții
          </span>
        </div>
        <div className="flex min-h-[250px] flex-1 items-center">
          <SankeyDiagram data={sankeyData} />
        </div>
        <div className="flex justify-end border-t pt-4">
          <Button onClick={onConfirm} disabled={!canConfirm || isPending}>
            {isPending ? "Se finalizează…" : "Finalizează procesul →"}
          </Button>
        </div>
      </div>
    </div>
  );
}
